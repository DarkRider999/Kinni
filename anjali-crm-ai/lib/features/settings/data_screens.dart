import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;

import '../common/file_actions.dart';
import '../../core/config/firebase_config.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../data/backup/backup_service.dart';
import '../../data/export/excel_exporter.dart';
import '../../data/export/export_bundle.dart';
import '../../data/export/pdf_exporter.dart';
import '../../data/remote/sync_service.dart';
import '../../domain/services/report_engine.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import 'settings_widgets.dart';


// ── Export ──────────────────────────────────────────────────────────────────

/// Excel / PDF export for a chosen period (REP-03/05).
class ExportScreen extends ConsumerStatefulWidget {
  const ExportScreen({super.key});

  @override
  ConsumerState<ExportScreen> createState() => _ExportScreenState();
}

class _ExportScreenState extends ConsumerState<ExportScreen> {
  ReportPeriod _period = ReportPeriod.thisMonth;

  ExportBundle _bundle() {
    final now = DateTime.now();
    final clients = ReportEngine.inPeriod(ref.read(clientsProvider).value ?? const [], _period, now);
    final ids = {for (final c in clients) c.id};
    final followups = (ref.read(followupsProvider).value ?? const []).where((f) => ids.contains(f.clientId)).toList();
    return ExportBundle(
      clients: clients,
      followups: followups,
      documents: (ref.read(documentsProvider).value ?? const []).where((d) => ids.contains(d.clientId)).toList(),
      products: ref.read(productsProvider).value ?? const [],
      calls: (ref.read(callLogsProvider).value ?? const []).where((c) => ids.contains(c.clientId)).toList(),
      kpis: ReportEngine.kpis(clients, followups, now: now, clientsWithPendingDocs: ref.read(clientsWithPendingDocsProvider)),
      period: _period,
      agentName: ref.read(profileProvider).name,
      generatedAt: now,
    );
  }

  Future<void> _export({required bool pdf}) async {
    File file;
    try {
      file = await withProgress(context, () => pdf ? PdfExporter.exportReport(_bundle()) : ExcelExporter.export(_bundle()),
          message: 'Preparing ${pdf ? 'PDF' : 'Excel'}…');
    } catch (e) {
      if (mounted) showSnack(context, 'Export failed: $e', error: true);
      return;
    }
    if (!mounted) return;
    final action = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(title: Text(p.basename(file.path), maxLines: 1, overflow: TextOverflow.ellipsis), subtitle: Text(fileSizeLabel(file.lengthSync()))),
          ListTile(leading: const Icon(Icons.share_rounded), title: const Text('Share'), onTap: () => Navigator.pop(c, 'share')),
          ListTile(leading: const Icon(Icons.save_alt_rounded), title: const Text('Save to device…'), onTap: () => Navigator.pop(c, 'save')),
        ]),
      ),
    );
    if (!mounted) return;
    if (action == 'share') {
      await safeShare(context, [file.path]);
    } else if (action == 'save') {
      if (await safeSaveCopy(context, file) && mounted) showSnack(context, 'Saved');
    }
  }

  @override
  Widget build(BuildContext context) => SettingsPage(
        title: 'Export data',
        children: [
          SettingsGroup(title: 'Period', icon: Icons.date_range_rounded, children: [
            for (final period in ReportPeriod.values)
              ListTile(
                leading: Icon(_period == period ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                    color: _period == period ? AppColors.primary : null),
                title: Text(period.label),
                onTap: () => setState(() => _period = period),
              ),
            const SettingsNote('Leads are included by the date they were created.'),
          ]),
          SettingsGroup(title: 'Format', icon: Icons.description_outlined, children: [
            SettingsTile(
              icon: Icons.table_chart_outlined,
              color: AppColors.success,
              title: 'Excel workbook (.xlsx)',
              subtitle: 'All leads plus approved, rejected, disbursed and pending-documents sheets',
              onTap: () => _export(pdf: false),
            ),
            SettingsTile(
              icon: Icons.picture_as_pdf_outlined,
              color: AppColors.danger,
              title: 'PDF report',
              subtitle: 'KPIs and summary tables',
              onTap: () => _export(pdf: true),
            ),
          ]),
          const SizedBox(height: 12),
          const SettingsNote('Exports contain customer data. Share them only with people you trust.', icon: Icons.warning_amber_rounded),
        ],
      );
}

// ── Backup & restore ────────────────────────────────────────────────────────

/// Local ZIP backups: create, list, share, delete and restore (FR-BAK).
class BackupScreen extends ConsumerStatefulWidget {
  const BackupScreen({super.key});

  @override
  ConsumerState<BackupScreen> createState() => _BackupScreenState();
}

class _BackupScreenState extends ConsumerState<BackupScreen> {
  late Future<List<File>> _backups = ref.read(backupServiceProvider).listBackups();

  void _refresh() => setState(() => _backups = ref.read(backupServiceProvider).listBackups());

  Future<void> _backupNow() async {
    try {
      final f = await withProgress(context, () => ref.read(backupServiceProvider).createBackup(), message: 'Creating backup…');
      if (mounted) showSnack(context, 'Backup created: ${p.basename(f.path)}');
    } catch (e) {
      if (mounted) showSnack(context, 'Backup failed: $e', error: true);
    }
    _refresh();
  }

  Future<void> _shareBackup(File f, {required bool save}) async {
    final ok = await confirm(context,
        title: 'Contains customer data',
        message: 'This backup holds all your clients, documents and notes in readable form. Keep it somewhere private.',
        ok: save ? 'Save' : 'Share');
    if (!ok || !mounted) return;
    if (save) {
      if (await safeSaveCopy(context, f) && mounted) showSnack(context, 'Saved');
    } else {
      await safeShare(context, [f.path]);
    }
  }

  Future<void> _delete(File f) async {
    final ok = await confirm(context, title: 'Delete backup?', message: p.basename(f.path), ok: 'Delete', destructive: true);
    if (!ok) return;
    await f.delete();
    _refresh();
  }

  Future<void> _pickAndRestore() async {
    String? path;
    try {
      final r = await FilePicker.pickFiles(type: FileType.custom, allowedExtensions: ['zip']);
      path = r.isEmpty ? null : r.first.path;
    } catch (e) {
      if (mounted) showSnack(context, 'Could not open the file picker: $e', error: true);
      return;
    }
    if (path != null) await _restore(File(path));
  }

  Future<void> _restore(File zip) async {
    final service = ref.read(backupServiceProvider);
    Map<String, dynamic> manifest;
    try {
      manifest = await service.inspect(zip);
    } catch (e) {
      if (mounted) showSnack(context, e is FormatException ? e.message : 'Could not read the backup: $e', error: true);
      return;
    }
    if (!mounted) return;
    final counts = Map<String, dynamic>.from(manifest['counts'] as Map? ?? const {});
    final created = DateTime.tryParse('${manifest['createdAt']}');
    final summary = [
      if (created != null) 'Created ${Fmt.dateTime(created)}',
      if (manifest['owner'] != null) 'Owner: ${manifest['owner']}',
      for (final e in counts.entries) '${_label(e.key)}: ${e.value}',
      'Files: ${manifest['files'] ?? 0}',
    ].join('\n');
    final ok = await confirm(context,
        title: 'Restore this backup?', message: '$summary\n\nThis replaces all current data on this device.', ok: 'Restore', destructive: true);
    if (!ok || !mounted) return;
    try {
      final restored = await withProgress(context, () => service.restore(zip), message: 'Restoring…');
      await ref.read(crmActionsProvider).rescheduleAllReminders();
      final total = restored.values.fold<int>(0, (a, b) => a + b);
      if (mounted) showSnack(context, 'Restored $total records');
    } catch (e) {
      if (mounted) showSnack(context, 'Restore failed: $e', error: true);
    }
  }

  static String _label(String box) => box.isEmpty ? box : '${box[0].toUpperCase()}${box.substring(1)}';

  @override
  Widget build(BuildContext context) {
    final last = ref.read(settingsStoreProvider).lastBackupAt;
    return SettingsPage(
      title: 'Backup & restore',
      children: [
        GlassCard(
          child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
            Row(children: [
              const SettingsIcon(icon: Icons.history_rounded, color: AppColors.info),
              const SizedBox(width: 12),
              Expanded(
                child: Text(last == null ? 'No backup yet' : 'Last backup ${Fmt.dateTime(last)}',
                    style: const TextStyle(fontWeight: FontWeight.w700)),
              ),
            ]),
            const SizedBox(height: 14),
            GradientButton(label: 'Backup now', icon: Icons.backup_rounded, onPressed: _backupNow),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: _pickAndRestore,
              icon: const Icon(Icons.restore_rounded),
              label: const Text('Restore from file…'),
            ),
          ]),
        ),
        const SettingsNote('An automatic backup is made every day; the newest ${BackupService.keepAutomatic} are kept.'),
        FutureBuilder<List<File>>(
          future: _backups,
          builder: (context, s) {
            final files = s.data ?? const <File>[];
            return SettingsGroup(title: 'Backups on this device', icon: Icons.folder_zip_outlined, children: [
              if (s.connectionState != ConnectionState.done)
                const Padding(padding: EdgeInsets.all(20), child: Center(child: CircularProgressIndicator()))
              else if (files.isEmpty)
                const SettingsNote('No backups yet.')
              else
                for (final f in files) _backupTile(f),
            ]);
          },
        ),
      ],
    );
  }

  Widget _backupTile(File f) {
    final auto = p.basename(f.path).contains('_auto_');
    return ListTile(
      leading: SettingsIcon(icon: auto ? Icons.schedule_rounded : Icons.inventory_2_outlined, color: auto ? AppColors.chart[5] : AppColors.info),
      title: Text(p.basename(f.path), maxLines: 1, overflow: TextOverflow.ellipsis, style: const TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
      subtitle: Text('${Fmt.dateTime(f.lastModifiedSync())} · ${fileSizeLabel(f.lengthSync())}'),
      trailing: PopupMenuButton<String>(
        onSelected: (v) => switch (v) {
          'restore' => _restore(f),
          'share' => _shareBackup(f, save: false),
          'save' => _shareBackup(f, save: true),
          _ => _delete(f),
        },
        itemBuilder: (_) => const [
          PopupMenuItem(value: 'restore', child: Text('Restore')),
          PopupMenuItem(value: 'share', child: Text('Share')),
          PopupMenuItem(value: 'save', child: Text('Save to device…')),
          PopupMenuItem(value: 'delete', child: Text('Delete')),
        ],
      ),
    );
  }
}

// ── Cloud sync ──────────────────────────────────────────────────────────────

/// Firebase sync status, toggle and manual sync.
class CloudSyncScreen extends ConsumerStatefulWidget {
  const CloudSyncScreen({super.key});

  @override
  ConsumerState<CloudSyncScreen> createState() => _CloudSyncScreenState();
}

class _CloudSyncScreenState extends ConsumerState<CloudSyncScreen> {
  late bool _enabled = ref.read(settingsStoreProvider).cloudSyncEnabled;
  SyncReport? _report;

  static (String, IconData, Color) _describe(SyncStatus s) => switch (s) {
        SyncStatus.notConfigured => ('Not configured', Icons.cloud_off_rounded, AppColors.danger),
        SyncStatus.disabled => ('Turned off', Icons.cloud_off_rounded, AppColors.warning),
        SyncStatus.offline => ('Offline', Icons.wifi_off_rounded, AppColors.warning),
        SyncStatus.idle => ('Up to date', Icons.cloud_done_rounded, AppColors.success),
        SyncStatus.syncing => ('Syncing…', Icons.cloud_sync_rounded, AppColors.info),
        SyncStatus.error => ('Last sync failed', Icons.error_outline_rounded, AppColors.danger),
      };

  Future<void> _syncNow() async {
    final r = await ref.read(syncServiceProvider).syncNow();
    if (mounted) setState(() => _report = r);
  }

  @override
  Widget build(BuildContext context) {
    final configured = FirebaseConfig.isConfigured;
    final status = configured ? (ref.watch(syncStatusProvider).value ?? ref.read(syncServiceProvider).status.value) : SyncStatus.notConfigured;
    final (label, icon, color) = _describe(status);
    final last = ref.read(settingsStoreProvider).lastSyncAt;
    final r = _report;
    return SettingsPage(
      title: 'Cloud sync',
      children: [
        GlassCard(
          child: Row(children: [
            SettingsIcon(icon: icon, color: color),
            const SizedBox(width: 12),
            Expanded(
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(label, style: TextStyle(fontWeight: FontWeight.w800, color: color)),
                Text(last == null ? 'Never synced' : 'Last sync ${Fmt.dateTime(last)}', style: Theme.of(context).textTheme.bodySmall),
              ]),
            ),
          ]),
        ),
        if (!configured)
          const SettingsGroup(title: 'Setup needed', icon: Icons.build_circle_outlined, children: [
            SettingsNote('Cloud sync needs a Firebase project. Add config/firebase.json and build with '
                '--dart-define-from-file=config/firebase.json. Until then all data stays only on this device.'),
          ])
        else
          SettingsGroup(title: 'Sync', icon: Icons.sync_rounded, children: [
            SwitchListTile(
              secondary: const SettingsIcon(icon: Icons.cloud_upload_outlined),
              title: const Text('Sync to cloud', style: TextStyle(fontWeight: FontWeight.w600)),
              subtitle: const Text('Back up changes to your Firebase project'),
              value: _enabled,
              onChanged: (v) async {
                setState(() => _enabled = v);
                await ref.read(settingsStoreProvider).setCloudSyncEnabled(v);
                if (v) ref.read(syncServiceProvider).requestSync();
              },
            ),
            SettingsTile(
              icon: Icons.sync_rounded,
              color: AppColors.info,
              title: 'Sync now',
              trailing: status == SyncStatus.syncing ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.4)) : null,
              onTap: status == SyncStatus.syncing || !_enabled ? null : _syncNow,
            ),
            if (r != null)
              SettingsNote(
                r.ok ? 'Pushed ${r.pushed} · pulled ${r.pulled} · uploaded ${r.filesUploaded} files' : 'Sync failed: ${r.error}',
                icon: r.ok ? Icons.check_circle_outline_rounded : Icons.error_outline_rounded,
              ),
          ]),
      ],
    );
  }
}

// ── Sample data ─────────────────────────────────────────────────────────────

/// Loads or removes the demo clients.
class SampleDataScreen extends ConsumerWidget {
  const SampleDataScreen({super.key});

  Future<void> _run(BuildContext context, WidgetRef ref, {required bool load}) async {
    final ok = await confirm(context,
        title: load ? 'Load sample data?' : 'Clear sample data?',
        message: load
            ? 'Adds demo clients, followups, calls and documents so you can explore the app.'
            : 'Removes every sample client and their followups, calls, documents and timeline. Your real data is not touched.',
        ok: load ? 'Load' : 'Clear',
        destructive: !load);
    if (!ok || !context.mounted) return;
    final actions = ref.read(crmActionsProvider);
    final n = await withProgress(context, () => load ? actions.loadSampleData() : actions.clearSampleData());
    if (context.mounted) showSnack(context, load ? 'Loaded $n sample clients' : 'Removed $n sample clients');
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) => SettingsPage(
        title: 'Sample data',
        children: [
          SettingsGroup(title: 'Demo clients', icon: Icons.science_outlined, children: [
            const SettingsNote('Sample clients are marked in their remarks so they can be removed safely later.'),
            SettingsTile(
              icon: Icons.playlist_add_rounded,
              color: AppColors.success,
              title: 'Load sample data',
              onTap: () => _run(context, ref, load: true),
            ),
            SettingsTile(
              icon: Icons.playlist_remove_rounded,
              color: AppColors.danger,
              title: 'Clear sample data',
              onTap: () => _run(context, ref, load: false),
            ),
          ]),
        ],
      );
}
