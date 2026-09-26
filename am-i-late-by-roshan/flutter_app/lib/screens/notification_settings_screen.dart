import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../models/notification_preference.dart';
import '../utils/format.dart';

class NotificationSettingsScreen extends StatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  State<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends State<NotificationSettingsScreen> {
  NotificationPreference? _prefs;
  bool _pushConfigured = false;
  List<AppNotification> _inbox = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    final scope = AppScope.of(context);
    try {
      final prefs = await scope.api.getNotificationPreferences();
      final inbox = await scope.api.listNotifications();
      if (!mounted) return;
      setState(() {
        _prefs = prefs.prefs;
        _pushConfigured = prefs.pushConfigured;
        _inbox = inbox;
      });
      if (inbox.any((n) => !n.read)) await scope.notifications.markAllRead();
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _update(NotificationPreference p) async {
    setState(() => _prefs = p);
    try {
      final saved = await AppScope.of(context).api.updateNotificationPreferences(p);
      if (mounted) setState(() => _prefs = saved);
    } catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  Future<String?> _pickTime(String? current) async {
    final parts = (current ?? '22:00').split(':').map(int.parse).toList();
    final t = await showTimePicker(context: context, initialTime: TimeOfDay(hour: parts[0], minute: parts[1]));
    return t == null ? null : '${t.hour.toString().padLeft(2, '0')}:${t.minute.toString().padLeft(2, '0')}';
  }

  IconData _kindIcon(String kind) => switch (kind) {
        'EARLY_WARNING' => Icons.traffic,
        'LEAVE_NOW' => Icons.directions_run,
        'SPEED' => Icons.speed,
        'FATIGUE' => Icons.bedtime,
        'TRIP' => Icons.flag,
        _ => Icons.notifications,
      };

  @override
  Widget build(BuildContext context) {
    final p = _prefs;
    final scope = AppScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Alerts')),
      body: _error != null
          ? Center(child: Text(_error!))
          : p == null
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: _load,
                  child: ListView(
                    children: [
                      SwitchListTile(
                        secondary: const Icon(Icons.traffic_outlined),
                        title: const Text('Traffic early warnings'),
                        subtitle: Text('When my commute gets ${p.etaIncreaseThresholdMinutes}+ min slower'),
                        value: p.earlyWarningEnabled,
                        onChanged: (v) => _update(p.copyWith(earlyWarningEnabled: v)),
                      ),
                      if (p.earlyWarningEnabled)
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 16),
                          child: Slider(
                            value: p.etaIncreaseThresholdMinutes.toDouble(),
                            min: 3,
                            max: 30,
                            divisions: 27,
                            label: '${p.etaIncreaseThresholdMinutes} min',
                            onChanged: (v) => setState(() => _prefs = p.copyWith(etaIncreaseThresholdMinutes: v.round())),
                            onChangeEnd: (v) => _update(p.copyWith(etaIncreaseThresholdMinutes: v.round())),
                          ),
                        ),
                      SwitchListTile(
                        secondary: const Icon(Icons.directions_run),
                        title: const Text('Time to leave'),
                        value: p.leaveNowEnabled,
                        onChanged: (v) => _update(p.copyWith(leaveNowEnabled: v)),
                      ),
                      SwitchListTile(
                        secondary: const Icon(Icons.speed),
                        title: const Text('Speed alerts'),
                        value: p.speedAlertsEnabled,
                        onChanged: (v) => _update(p.copyWith(speedAlertsEnabled: v)),
                      ),
                      SwitchListTile(
                        secondary: const Icon(Icons.bedtime_outlined),
                        title: const Text('Fatigue alerts'),
                        value: p.fatigueAlertsEnabled,
                        onChanged: (v) => _update(p.copyWith(fatigueAlertsEnabled: v)),
                      ),
                      ListTile(
                        leading: const Icon(Icons.do_not_disturb_on_outlined),
                        title: const Text('Quiet hours'),
                        subtitle: Text(p.quietHoursStart == null ? 'Off' : '${p.quietHoursStart} - ${p.quietHoursEnd}'),
                        trailing: p.quietHoursStart == null
                            ? const Icon(Icons.add)
                            : IconButton(
                                icon: const Icon(Icons.clear),
                                onPressed: () => _update(p.copyWith(quietHoursStart: () => null, quietHoursEnd: () => null)),
                              ),
                        onTap: () async {
                          final start = await _pickTime(p.quietHoursStart);
                          if (start == null || !mounted) return;
                          final end = await _pickTime(p.quietHoursEnd ?? '06:00');
                          if (end == null) return;
                          _update(p.copyWith(quietHoursStart: () => start, quietHoursEnd: () => end));
                        },
                      ),
                      ListTile(
                        leading: Icon(scope.notifications.firebaseEnabled && _pushConfigured ? Icons.cloud_done_outlined : Icons.info_outline),
                        title: Text(scope.notifications.firebaseEnabled && _pushConfigured ? 'Push notifications active' : 'In-app alerts'),
                        subtitle: Text(scope.notifications.firebaseEnabled && _pushConfigured
                            ? 'Alerts reach you even when the app is closed.'
                            : 'Alerts arrive while the app is open or in the background. Add Firebase to get them when it is closed.'),
                      ),
                      const Divider(),
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 8, 16, 4),
                        child: Text('Recent alerts', style: Theme.of(context).textTheme.titleSmall),
                      ),
                      if (_inbox.isEmpty) const ListTile(title: Text('No alerts yet')),
                      for (final n in _inbox)
                        ListTile(
                          leading: Icon(_kindIcon(n.kind)),
                          title: Text(n.title, style: TextStyle(fontWeight: n.read ? FontWeight.normal : FontWeight.bold)),
                          subtitle: Text('${n.body}\n${formatClock(n.createdAt)}'),
                          isThreeLine: true,
                        ),
                    ],
                  ),
                ),
    );
  }
}
