import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../app_scope.dart';
import '../models/driver_profile.dart';
import '../models/place.dart';
import '../models/route_option.dart';
import '../utils/format.dart';
import '../widgets/place_search_field.dart';
import 'notification_settings_screen.dart';

class SettingsScreen extends StatefulWidget {
  final bool openCommuteEditor;
  const SettingsScreen({super.key, this.openCommuteEditor = false});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  DriverProfile? _profile;
  List<CommuteProfile> _commutes = [];
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await _load();
      if (widget.openCommuteEditor && mounted) _editCommute(null);
    });
  }

  Future<void> _load() async {
    final api = AppScope.of(context).api;
    try {
      final results = await Future.wait([api.getDriverProfile(), api.listCommutes()]);
      if (mounted) {
        setState(() {
          _profile = results[0] as DriverProfile;
          _commutes = results[1] as List<CommuteProfile>;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    }
  }

  Future<void> _update(DriverProfile p) async {
    setState(() => _profile = p);
    try {
      final saved = await AppScope.of(context).api.updateDriverProfile(p);
      if (mounted) setState(() => _profile = saved);
    } catch (e) {
      _toast(e.toString());
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _editCommute(CommuteProfile? existing) async {
    final saved = await Navigator.push<bool>(context, MaterialPageRoute(builder: (_) => CommuteEditor(existing: existing)));
    if (saved == true) _load();
  }

  Future<void> _export() async {
    try {
      final data = await AppScope.of(context).api.exportData();
      final json = const JsonEncoder.withIndent('  ').convert(data);
      await Clipboard.setData(ClipboardData(text: json));
      _toast('Your data (${(json.length / 1024).toStringAsFixed(1)} KB of JSON) was copied to the clipboard.');
    } catch (e) {
      _toast(e.toString());
    }
  }

  Future<void> _deleteAccount() async {
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete account?'),
        content: const Text('This permanently deletes your account, trips, commutes and alerts. It cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: Theme.of(context).colorScheme.error),
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    final scope = AppScope.of(context);
    final navigator = Navigator.of(context);
    try {
      await scope.notifications.stop();
      await scope.api.deleteAccount();
      navigator.popUntil((r) => r.isFirst);
    } catch (e) {
      _toast(e.toString());
    }
  }

  Future<void> _editServer() async {
    final api = AppScope.of(context).api;
    final controller = TextEditingController(text: api.baseUrl);
    final url = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Server address'),
        content: TextField(controller: controller, keyboardType: TextInputType.url),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Save')),
        ],
      ),
    );
    if (url != null && url.trim().isNotEmpty) {
      await api.setBaseUrl(url);
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final scope = AppScope.of(context);
    final p = _profile;
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: _error != null
          ? Center(child: Padding(padding: const EdgeInsets.all(24), child: Text(_error!, textAlign: TextAlign.center)))
          : p == null
              ? const Center(child: CircularProgressIndicator())
              : ListView(
                  children: [
                    _Header('My commutes'),
                    for (final c in _commutes)
                      ListTile(
                        leading: Icon(c.active ? Icons.work_outline : Icons.work_off_outlined),
                        title: Text(c.name),
                        subtitle: Text('${c.originLabel} → ${c.destinationLabel}\nArrive ${c.targetArrivalTime} · ${formatDays(c.daysOfWeek)}'),
                        isThreeLine: true,
                        trailing: const Icon(Icons.edit_outlined),
                        onTap: () => _editCommute(c),
                      ),
                    ListTile(leading: const Icon(Icons.add), title: const Text('Add a commute'), onTap: () => _editCommute(null)),
                    const Divider(),
                    _Header('Driving'),
                    ListTile(
                      leading: const Icon(Icons.alt_route),
                      title: const Text('Preferred route'),
                      trailing: DropdownButton<RouteType>(
                        value: p.preferredRouteType,
                        onChanged: (v) => v == null ? null : _update(p.copyWith(preferredRouteType: v)),
                        items: [for (final t in RouteType.values) DropdownMenuItem(value: t, child: Text(t.label))],
                      ),
                    ),
                    ListTile(
                      leading: const Icon(Icons.timer_outlined),
                      title: const Text('Safety buffer'),
                      subtitle: Slider(
                        value: p.bufferMinutes.toDouble(),
                        min: 0,
                        max: 30,
                        divisions: 30,
                        label: '${p.bufferMinutes} min',
                        onChanged: (v) => setState(() => _profile = p.copyWith(bufferMinutes: v.round())),
                        onChangeEnd: (v) => _update(p.copyWith(bufferMinutes: v.round())),
                      ),
                      trailing: Text('${p.bufferMinutes} min'),
                    ),
                    SwitchListTile(
                      secondary: const Icon(Icons.toll),
                      title: const Text('I have a Salik tag'),
                      value: p.hasSalikTag,
                      onChanged: (v) => _update(p.copyWith(hasSalikTag: v)),
                    ),
                    SwitchListTile(
                      secondary: const Icon(Icons.toll_outlined),
                      title: const Text('I have a DARB account'),
                      value: p.hasDarbAccount,
                      onChanged: (v) => _update(p.copyWith(hasDarbAccount: v)),
                    ),
                    ListTile(
                      leading: const Icon(Icons.speed),
                      title: const Text('Speed alert tolerance'),
                      subtitle: Slider(
                        value: p.speedAlertThresholdKmh.toDouble(),
                        min: 0,
                        max: 20,
                        divisions: 20,
                        label: '+${p.speedAlertThresholdKmh} km/h',
                        onChanged: (v) => setState(() => _profile = p.copyWith(speedAlertThresholdKmh: v.round())),
                        onChangeEnd: (v) => _update(p.copyWith(speedAlertThresholdKmh: v.round())),
                      ),
                      trailing: Text('+${p.speedAlertThresholdKmh}'),
                    ),
                    SwitchListTile(
                      secondary: const Icon(Icons.bedtime_outlined),
                      title: const Text('Fatigue monitoring'),
                      subtitle: const Text('Uses drive time and motion sensors on this phone'),
                      value: p.fatigueMonitoringEnabled,
                      onChanged: (v) => _update(p.copyWith(fatigueMonitoringEnabled: v)),
                    ),
                    ListTile(
                      leading: const Icon(Icons.local_cafe_outlined),
                      title: const Text('Break reminder after'),
                      trailing: DropdownButton<int>(
                        value: p.maxContinuousDriveMinutes,
                        onChanged: (v) => v == null ? null : _update(p.copyWith(maxContinuousDriveMinutes: v)),
                        items: [
                          for (final m in {60, 90, 120, 150, 180, 240, p.maxContinuousDriveMinutes}.toList()..sort())
                            DropdownMenuItem(value: m, child: Text(formatMinutes(m))),
                        ],
                      ),
                    ),
                    const Divider(),
                    _Header('Alerts & privacy'),
                    ListTile(
                      leading: const Icon(Icons.notifications_outlined),
                      title: const Text('Notification settings'),
                      trailing: const Icon(Icons.chevron_right),
                      onTap: () => Navigator.push(context, MaterialPageRoute(builder: (_) => const NotificationSettingsScreen())),
                    ),
                    ListTile(leading: const Icon(Icons.download_outlined), title: const Text('Export my data'), onTap: _export),
                    ListTile(
                      leading: Icon(Icons.delete_forever_outlined, color: theme.colorScheme.error),
                      title: Text('Delete my account', style: TextStyle(color: theme.colorScheme.error)),
                      onTap: _deleteAccount,
                    ),
                    const Divider(),
                    _Header('App'),
                    ListTile(leading: const Icon(Icons.dns_outlined), title: const Text('Server address'), subtitle: Text(scope.api.baseUrl), onTap: _editServer),
                    ListTile(
                      leading: const Icon(Icons.logout),
                      title: const Text('Sign out'),
                      onTap: () async {
                        final navigator = Navigator.of(context);
                        await scope.notifications.stop();
                        await scope.api.logout();
                        navigator.popUntil((r) => r.isFirst);
                      },
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
    );
  }
}

class _Header extends StatelessWidget {
  final String text;
  const _Header(this.text);
  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 4),
        child: Text(text, style: Theme.of(context).textTheme.titleSmall?.copyWith(color: Theme.of(context).colorScheme.primary)),
      );
}

/// Create / edit a commute watched by the early-warning job.
class CommuteEditor extends StatefulWidget {
  final CommuteProfile? existing;
  const CommuteEditor({super.key, this.existing});

  @override
  State<CommuteEditor> createState() => _CommuteEditorState();
}

class _CommuteEditorState extends State<CommuteEditor> {
  late final _name = TextEditingController(text: widget.existing?.name ?? 'Home to Work');
  Place? _origin;
  Place? _destination;
  late TimeOfDay _arrive;
  late Set<int> _days;
  late bool _active;
  bool _saving = false;

  @override
  void initState() {
    super.initState();
    final c = widget.existing;
    if (c != null) {
      _origin = Place(lat: c.originLat, lng: c.originLng, label: c.originLabel);
      _destination = Place(lat: c.destinationLat, lng: c.destinationLng, label: c.destinationLabel);
      final parts = c.targetArrivalTime.split(':').map(int.parse).toList();
      _arrive = TimeOfDay(hour: parts[0], minute: parts[1]);
    } else {
      _arrive = const TimeOfDay(hour: 8, minute: 30);
    }
    _days = {...?c?.daysOfWeek, if (c == null) ...[1, 2, 3, 4, 5]};
    _active = c?.active ?? true;
  }

  @override
  void dispose() {
    _name.dispose();
    super.dispose();
  }

  Future<Place?> _current() async {
    final scope = AppScope.of(context);
    final pos = await scope.location.current();
    try {
      final r = await scope.api.reverseGeocode(pos.latitude, pos.longitude);
      return Place(lat: pos.latitude, lng: pos.longitude, label: r.label);
    } catch (_) {
      return Place(lat: pos.latitude, lng: pos.longitude, label: 'Current location');
    }
  }

  String get _hhmm => '${_arrive.hour.toString().padLeft(2, '0')}:${_arrive.minute.toString().padLeft(2, '0')}';

  Future<void> _save() async {
    if (_origin == null || _destination == null || _days.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Choose both places and at least one day.')));
      return;
    }
    setState(() => _saving = true);
    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    try {
      await AppScope.of(context).api.saveCommute(CommuteProfile(
            id: widget.existing?.id,
            name: _name.text.trim().isEmpty ? 'Commute' : _name.text.trim(),
            originLat: _origin!.lat,
            originLng: _origin!.lng,
            originLabel: _origin!.label,
            destinationLat: _destination!.lat,
            destinationLng: _destination!.lng,
            destinationLabel: _destination!.label,
            targetArrivalTime: _hhmm,
            daysOfWeek: _days.toList()..sort(),
            active: _active,
          ));
      navigator.pop(true);
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Future<void> _delete() async {
    final navigator = Navigator.of(context);
    await AppScope.of(context).api.deleteCommute(widget.existing!.id!);
    navigator.pop(true);
  }

  Future<void> _testAlert() async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final r = await AppScope.of(context).api.checkCommute(widget.existing!.id!);
      final sent = (r['sent'] as List).cast<String>();
      messenger.showSnackBar(SnackBar(
        content: Text(r['skipped'] != null
            ? 'Not checked: ${r['skipped']} (alerts run up to 3 h before arrival on selected days).'
            : 'Current ETA ${formatMinutes(r['etaMinutes'] as num)}${sent.isEmpty ? '' : ' · sent ${sent.join(', ')}'}'),
      ));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.existing == null ? 'New commute' : 'Edit commute'),
        actions: [if (widget.existing != null) IconButton(tooltip: 'Delete', onPressed: _delete, icon: const Icon(Icons.delete_outline))],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name', border: OutlineInputBorder())),
          const SizedBox(height: 12),
          PlaceSearchField(hint: 'From (e.g. home)', icon: Icons.home_outlined, value: _origin, onSelected: (p) => setState(() => _origin = p), onUseCurrentLocation: _current),
          const SizedBox(height: 12),
          PlaceSearchField(hint: 'To (e.g. office)', icon: Icons.work_outline, value: _destination, onSelected: (p) => setState(() => _destination = p), onUseCurrentLocation: _current),
          const SizedBox(height: 12),
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: const Icon(Icons.access_time),
            title: const Text('Arrive by'),
            trailing: Text(_arrive.format(context), style: Theme.of(context).textTheme.titleMedium),
            onTap: () async {
              final t = await showTimePicker(context: context, initialTime: _arrive);
              if (t != null) setState(() => _arrive = t);
            },
          ),
          Wrap(
            spacing: 6,
            children: [
              for (var d = 1; d <= 7; d++)
                FilterChip(
                  label: Text(weekdayShort[d - 1]),
                  selected: _days.contains(d),
                  onSelected: (on) => setState(() => on ? _days.add(d) : _days.remove(d)),
                ),
            ],
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            title: const Text('Watch this commute'),
            subtitle: const Text('Early warnings and "time to leave" alerts'),
            value: _active,
            onChanged: (v) => setState(() => _active = v),
          ),
          const SizedBox(height: 12),
          FilledButton(
            onPressed: _saving ? null : _save,
            style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
            child: _saving ? const CircularProgressIndicator() : const Text('Save'),
          ),
          if (widget.existing != null)
            TextButton.icon(onPressed: _testAlert, icon: const Icon(Icons.play_arrow), label: const Text('Check traffic now')),
        ],
      ),
    );
  }
}
