import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart' show Color;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:flutter_timezone/flutter_timezone.dart';
import 'package:timezone/data/latest_all.dart' as tzdata;
import 'package:timezone/timezone.dart' as tz;

import '../../domain/entities/client.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/entities/followup.dart';
import '../utils/formatters.dart';

/// Followup reminders: 24 h, 3 h, 1 h before and at the exact time, plus a
/// one-off "missed" notification (FR FUP-03/04).
class NotificationService {
  NotificationService._();
  static final NotificationService instance = NotificationService._();

  final _plugin = FlutterLocalNotificationsPlugin();
  bool _ready = false;

  /// Emits notification payloads (`followup:<id>`) when the user taps one.
  final _taps = StreamController<String>.broadcast();
  Stream<String> get taps => _taps.stream;

  /// Payload that launched the app (cold start from a notification).
  String? launchPayload;

  static const defaultOffsetsMinutes = [1440, 180, 60, 0];

  static const _remindersChannel = AndroidNotificationDetails(
    'followup_reminders',
    'Followup reminders',
    channelDescription: 'Reminders before scheduled client followups',
    importance: Importance.max,
    priority: Priority.high,
    category: AndroidNotificationCategory.reminder,
    color: Color(0xFF6C63FF),
  );

  static const _missedChannel = AndroidNotificationDetails(
    'followup_missed',
    'Missed followups',
    channelDescription: 'Followups that passed without being completed',
    importance: Importance.high,
    priority: Priority.high,
    color: Color(0xFFFF6B9D),
  );

  static const _expiryChannel = AndroidNotificationDetails(
    'document_expiry',
    'Document expiry',
    channelDescription: 'Customer passports, visas and IDs nearing expiry',
    importance: Importance.high,
    priority: Priority.high,
    color: Color(0xFFF59E0B),
  );

  static const _generalChannel = AndroidNotificationDetails(
    'general',
    'General',
    channelDescription: 'Backups, sync and other app messages',
    importance: Importance.low,
    priority: Priority.low,
  );

  Future<void> init() async {
    if (_ready) return;
    tzdata.initializeTimeZones();
    try {
      final info = await FlutterTimezone.getLocalTimezone();
      tz.setLocalLocation(tz.getLocation(info.identifier));
    } catch (_) {
      tz.setLocalLocation(tz.getLocation('Asia/Dubai'));
    }
    await _plugin.initialize(
      settings: const InitializationSettings(android: AndroidInitializationSettings('@mipmap/ic_launcher')),
      onDidReceiveNotificationResponse: (r) {
        if (r.payload != null) _taps.add(r.payload!);
      },
    );
    final launch = await _plugin.getNotificationAppLaunchDetails();
    if (launch?.didNotificationLaunchApp ?? false) {
      launchPayload = launch!.notificationResponse?.payload;
    }
    _ready = true;
  }

  AndroidFlutterLocalNotificationsPlugin? get _android =>
      _plugin.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

  Future<void> requestPermissions() async {
    await _android?.requestNotificationsPermission();
    final canExact = await _android?.canScheduleExactNotifications() ?? true;
    if (!canExact) await _android?.requestExactAlarmsPermission();
  }

  Future<AndroidScheduleMode> _mode() async {
    final canExact = await _android?.canScheduleExactNotifications() ?? false;
    return canExact ? AndroidScheduleMode.exactAllowWhileIdle : AndroidScheduleMode.inexactAllowWhileIdle;
  }

  static String _offsetLabel(int minutes) {
    if (minutes == 0) return 'now';
    if (minutes % 1440 == 0) return 'in ${minutes ~/ 1440} day${minutes == 1440 ? '' : 's'}';
    if (minutes % 60 == 0) return 'in ${minutes ~/ 60} hour${minutes == 60 ? '' : 's'}';
    return 'in $minutes min';
  }

  /// Schedules up to 4 reminders (slots base+0..3); past ones are skipped.
  Future<void> scheduleFollowup(Followup f, Client c, {List<int> offsetsMinutes = defaultOffsetsMinutes}) async {
    if (!_ready) await init();
    await cancelFollowup(f);
    if (!f.isPending) return;
    final now = DateTime.now();
    final mode = await _mode();
    final offsets = offsetsMinutes.take(4).toList();
    for (var i = 0; i < offsets.length; i++) {
      final at = f.dueAt.subtract(Duration(minutes: offsets[i]));
      if (!at.isAfter(now)) continue;
      final when = _offsetLabel(offsets[i]);
      try {
        await _plugin.zonedSchedule(
          id: f.notificationBaseId + i,
          scheduledDate: tz.TZDateTime.from(at, tz.local),
          notificationDetails: const NotificationDetails(android: _remindersChannel),
          androidScheduleMode: mode,
          title: offsets[i] == 0 ? 'Followup now: ${c.name}' : 'Followup $when: ${c.name}',
          body: [Fmt.dateTime(f.dueAt), if (f.note != null && f.note!.isNotEmpty) f.note].join(' · '),
          payload: 'followup:${f.id}',
        );
      } catch (e) {
        debugPrint('schedule failed: $e');
      }
    }
  }

  /// Reminders 30, 15, 7 and 1 day(s) before a document expires, at 9 AM.
  Future<void> scheduleDocumentExpiry(ClientDocument d, Client c, String docName) async {
    if (!_ready) await init();
    await cancelDocumentExpiry(d);
    final exp = d.expiryDate;
    if (exp == null || d.deleted) return;
    final now = DateTime.now();
    final mode = await _mode();
    const days = [30, 15, 7, 1];
    for (var i = 0; i < days.length; i++) {
      final at = DateTime(exp.year, exp.month, exp.day - days[i], 9);
      if (!at.isAfter(now)) continue;
      try {
        await _plugin.zonedSchedule(
          id: d.notificationBaseId + i,
          scheduledDate: tz.TZDateTime.from(at, tz.local),
          notificationDetails: const NotificationDetails(android: _expiryChannel),
          androidScheduleMode: mode,
          title: '$docName expires in ${days[i]} day${days[i] == 1 ? '' : 's'}',
          body: '${c.name} · expiry ${Fmt.date(exp)}. Ask for a renewed copy.',
          payload: 'client:${c.id}',
        );
      } catch (e) {
        debugPrint('expiry schedule failed: $e');
      }
    }
  }

  Future<void> cancelDocumentExpiry(ClientDocument d) async {
    for (var i = 0; i < 4; i++) {
      await _plugin.cancel(id: d.notificationBaseId + i);
    }
  }

  Future<void> cancelFollowup(Followup f) async {
    for (var i = 0; i < 5; i++) {
      await _plugin.cancel(id: f.notificationBaseId + i);
    }
  }

  Future<void> showMissed(Followup f, Client c) async {
    if (!_ready) await init();
    await _plugin.show(
      id: f.notificationBaseId + 4,
      title: 'Missed followup: ${c.name}',
      body: 'Was due ${Fmt.dateTime(f.dueAt)}. Tap to call or reschedule.',
      notificationDetails: const NotificationDetails(android: _missedChannel),
      payload: 'followup:${f.id}',
    );
  }

  Future<void> showGeneral(int id, String title, String body) async {
    if (!_ready) await init();
    await _plugin.show(id: id, title: title, body: body, notificationDetails: const NotificationDetails(android: _generalChannel));
  }

  Future<void> cancelAll() => _plugin.cancelAll();
}
