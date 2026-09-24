import 'package:flutter/material.dart';

import '../state.dart';
import '../theme.dart';
import '../widgets.dart';

const _languages = {
  'en': 'English', 'hi': 'हिन्दी', 'es': 'Español', 'pt-BR': 'Português (BR)', 'id': 'Bahasa Indonesia',
  'ar': 'العربية', 'fr': 'Français', 'de': 'Deutsch', 'ja': '日本語', 'ko': '한국어',
};

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Map<String, dynamic>? _s;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_s == null) SessionScope.of(context).api.settings().then((s) => mounted ? setState(() => _s = s) : null);
  }

  Future<void> _save(String key, Object value) async {
    setState(() => _s![key] = value);
    try {
      final next = await SessionScope.of(context).api.putSettings({key: value});
      if (mounted) setState(() => _s = next);
    } catch (e) {
      if (mounted) showError(context, e);
    }
  }

  Widget _choices(String key, String label, List<(Object, String)> options) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label, style: const TextStyle(color: NF.text2, fontSize: 12)),
          const SizedBox(height: 6),
          Wrap(spacing: 6, runSpacing: 6, children: [
            for (final (v, l) in options) ChoiceChip(label: Text(l), selected: _s![key] == v, onSelected: (_) => _save(key, v)),
          ]),
        ]),
      );

  @override
  Widget build(BuildContext context) {
    final session = SessionScope.of(context);
    final me = session.me!;
    final s = _s;
    return ListView(padding: const EdgeInsets.all(16), children: [
      Row(children: [
        Expanded(child: Text('Settings', style: Theme.of(context).textTheme.headlineSmall)),
        const CreditRing(),
      ]),
      Text(me.email, style: const TextStyle(color: NF.text2)),
      const SizedBox(height: 12),
      if (s == null)
        const Center(child: CircularProgressIndicator())
      else ...[
        Card(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              _choices('quality_lane', 'Processing lane', const [('fast', 'Fast'), ('balanced', 'Balanced'), ('max', 'Max quality')]),
              _choices('default_image_format', 'Photo format', const [('jpg', 'JPG'), ('png', 'PNG'), ('webp', 'WEBP')]),
              _choices('default_video_format', 'Video format', const [('mp4', 'MP4'), ('mov', 'MOV'), ('gif', 'GIF')]),
              _choices('auto_delete_days', 'Auto-delete originals after', const [(1, '1 d'), (7, '7 d'), (30, '30 d'), (90, '90 d')]),
              DropdownButtonFormField<String>(
                key: const Key('language'),
                initialValue: s['language'] as String,
                decoration: const InputDecoration(labelText: 'Language'),
                items: [for (final e in _languages.entries) DropdownMenuItem(value: e.key, child: Text(e.value))],
                onChanged: (v) => v == null ? null : _save('language', v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Strip location & camera metadata'),
                value: s['strip_metadata'] == true,
                onChanged: (v) => _save('strip_metadata', v),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Notify when jobs finish'),
                value: s['notify_job_complete'] == true,
                onChanged: (v) => _save('notify_job_complete', v),
              ),
            ]),
          ),
        ),
        Card(
          child: ListTile(
            title: Text('${me.plan.name} plan'),
            subtitle: Text('${me.plan.monthlyCredits} credits/month · ${me.plan.maxBatchFiles} files/batch · '
                'up to ${me.plan.maxOutputRes.toUpperCase()} · ${me.plan.maxUpscale}x upscale'),
          ),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(onPressed: session.logout, icon: const Icon(Icons.logout), label: const Text('Sign out')),
      ],
    ]);
  }
}
