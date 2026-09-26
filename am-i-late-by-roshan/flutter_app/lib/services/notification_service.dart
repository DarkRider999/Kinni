import 'dart:async';
import 'dart:convert';
import 'dart:io' show Platform;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;

import '../models/notification_preference.dart';
import 'api_client.dart';

/// Delivers commute alerts to the phone. Works without Firebase:
///  - always: a live Server-Sent Events stream from the backend (plus an
///    inbox refresh on reconnect) shown as local notifications;
///  - optionally: Firebase Cloud Messaging for alerts while the app is closed,
///    when google-services.json / GoogleService-Info.plist are added.
class NotificationService extends ChangeNotifier {
  final ApiClient api;
  final _local = FlutterLocalNotificationsPlugin();
  final _incoming = StreamController<AppNotification>.broadcast();
  http.Client? _sseClient;
  StreamSubscription<String>? _sseSub;
  Timer? _reconnect;
  bool _running = false;
  bool firebaseEnabled = false;
  int unreadCount = 0;
  int _nextLocalId = 1;

  NotificationService(this.api);

  Stream<AppNotification> get incoming => _incoming.stream;

  static const _channel = AndroidNotificationChannel(
    'commute_alerts',
    'Commute alerts',
    description: 'Traffic early warnings, time-to-leave, speed and fatigue alerts',
    importance: Importance.high,
  );

  Future<void> init() async {
    if (kIsWeb) return;
    await _local.initialize(
      settings: const InitializationSettings(
        android: AndroidInitializationSettings('@mipmap/ic_launcher'),
        iOS: DarwinInitializationSettings(),
      ),
    );
    final android = _local.resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();
    await android?.createNotificationChannel(_channel);
    await android?.requestNotificationsPermission();
    await _initFirebase();
  }

  Future<void> _initFirebase() async {
    try {
      await Firebase.initializeApp();
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      firebaseEnabled = true;
      FirebaseMessaging.onMessage.listen((m) {
        // Foreground FCM messages duplicate the live stream; just refresh the badge.
        refreshUnread();
      });
      messaging.onTokenRefresh.listen(_registerToken);
    } catch (e) {
      // No Firebase config in this build: live stream + inbox still work.
      debugPrint('Firebase not configured, using in-app notifications only ($e)');
      firebaseEnabled = false;
    }
  }

  Future<void> _registerToken(String token) async {
    if (!api.isLoggedIn) return;
    try {
      await api.registerDevice(token, Platform.isIOS ? 'ios' : 'android');
    } catch (e) {
      debugPrint('Device registration failed: $e');
    }
  }

  /// Call after login: registers the FCM token and opens the live stream.
  Future<void> start() async {
    if (_running || !api.isLoggedIn) return;
    _running = true;
    if (firebaseEnabled) {
      try {
        final token = await FirebaseMessaging.instance.getToken();
        if (token != null) await _registerToken(token);
      } catch (e) {
        debugPrint('FCM token unavailable: $e');
      }
    }
    await refreshUnread();
    _connect();
  }

  Future<void> stop() async {
    _running = false;
    _reconnect?.cancel();
    await _sseSub?.cancel();
    _sseClient?.close();
    _sseClient = null;
  }

  Future<void> refreshUnread() async {
    try {
      unreadCount = (await api.listNotifications(unreadOnly: true)).length;
      notifyListeners();
    } catch (_) {}
  }

  Future<void> _connect() async {
    if (!_running) return;
    try {
      final (client, res) = await api.openNotificationStream();
      _sseClient = client;
      String? event;
      final data = StringBuffer();
      _sseSub = res.stream.transform(utf8.decoder).transform(const LineSplitter()).listen(
        (line) {
          if (line.startsWith('event:')) {
            event = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            data.write(line.substring(5).trim());
          } else if (line.isEmpty) {
            if (event == 'notification' && data.isNotEmpty) _onMessage(data.toString());
            event = null;
            data.clear();
          }
        },
        onDone: _scheduleReconnect,
        onError: (_) => _scheduleReconnect(),
        cancelOnError: true,
      );
    } catch (_) {
      _scheduleReconnect();
    }
  }

  void _scheduleReconnect() {
    _sseClient?.close();
    _sseClient = null;
    if (!_running) return;
    _reconnect?.cancel();
    _reconnect = Timer(const Duration(seconds: 10), () {
      refreshUnread();
      _connect();
    });
  }

  void _onMessage(String json) {
    try {
      final n = AppNotification.fromJson(jsonDecode(json) as Map<String, dynamic>);
      unreadCount++;
      notifyListeners();
      _incoming.add(n);
      showLocal(n.title, n.body);
    } catch (e) {
      debugPrint('Bad notification payload: $e');
    }
  }

  Future<void> showLocal(String title, String body) async {
    if (kIsWeb) return;
    await _local.show(
      id: _nextLocalId++,
      title: title,
      body: body,
      notificationDetails: NotificationDetails(
        android: AndroidNotificationDetails(_channel.id, _channel.name,
            channelDescription: _channel.description, importance: Importance.high, priority: Priority.high),
        iOS: const DarwinNotificationDetails(presentAlert: true, presentSound: true),
      ),
    );
  }

  Future<void> markAllRead() async {
    await api.markAllNotificationsRead();
    unreadCount = 0;
    notifyListeners();
  }

  @override
  void dispose() {
    stop();
    _incoming.close();
    super.dispose();
  }
}
