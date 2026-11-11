import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path/path.dart' as p;

import '../common/file_actions.dart';
import '../../core/widgets/common.dart';
import '../../data/export/excel_exporter.dart';
import '../../data/export/export_bundle.dart';
import '../../data/export/pdf_exporter.dart';
import '../../domain/entities/call_log.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/entities/followup.dart';
import '../../domain/entities/product.dart';
import '../../domain/services/report_engine.dart';
import '../../providers/app_providers.dart';

enum ExportKind { excel, pdf }

/// Builds the export bundle for [period] from live providers.
ExportBundle buildExportBundle(WidgetRef ref, ReportPeriod period) {
  final now = DateTime.now();
  final clients = ReportEngine.inPeriod(ref.read(clientsProvider).value ?? const [], period, now);
  final ids = clients.map((c) => c.id).toSet();
  final followups = (ref.read(followupsProvider).value ?? const <Followup>[]).where((f) => ids.contains(f.clientId)).toList();
  final docs = (ref.read(documentsProvider).value ?? const <ClientDocument>[]).where((d) => ids.contains(d.clientId)).toList();
  final calls = (ref.read(callLogsProvider).value ?? const <CallLog>[]).where((c) => ids.contains(c.clientId)).toList();
  final pendingDocIds = ref.read(clientsWithPendingDocsProvider);
  return ExportBundle(
    clients: clients,
    followups: followups,
    documents: docs,
    products: ref.read(productsProvider).value ?? const <Product>[],
    calls: calls,
    kpis: ReportEngine.kpis(clients, followups, now: now, clientsWithPendingDocs: pendingDocIds),
    period: period,
    agentName: ref.read(profileProvider).name,
    generatedAt: now,
  );
}

/// Generates the file, then offers Share (WhatsApp / Email / …) or Save.
Future<void> exportAndShare(BuildContext context, WidgetRef ref, ExportKind kind, ReportPeriod period) async {
  final bundle = buildExportBundle(ref, period);
  if (bundle.clients.isEmpty) {
    showSnack(context, 'No leads in "${period.label}" to export');
    return;
  }
  File file;
  try {
    file = kind == ExportKind.excel ? await ExcelExporter.export(bundle) : await PdfExporter.exportReport(bundle);
  } catch (e) {
    if (context.mounted) showSnack(context, 'Export failed: $e', error: true);
    return;
  }
  if (!context.mounted) return;
  await shareOrSaveFile(context, file, subject: 'Anjali CRM report · ${period.label}');
}

/// Bottom sheet: share via any app (WhatsApp, Email…) or save to device.
Future<void> shareOrSaveFile(BuildContext context, File file, {required String subject}) async {
  final choice = await showModalBottomSheet<String>(
    context: context,
    builder: (c) => SafeArea(
      child: Column(mainAxisSize: MainAxisSize.min, children: [
        ListTile(title: Text(p.basename(file.path), maxLines: 2), subtitle: Text('${(file.lengthSync() / 1024).toStringAsFixed(0)} KB')),
        ListTile(
          leading: const Icon(Icons.chat_rounded, color: Color(0xFF25D366)),
          title: const Text('Share via WhatsApp, Email or other app'),
          onTap: () => Navigator.pop(c, 'share'),
        ),
        ListTile(leading: const Icon(Icons.save_alt_rounded), title: const Text('Save to device'), onTap: () => Navigator.pop(c, 'save')),
        const SizedBox(height: 8),
      ]),
    ),
  );
  if (!context.mounted) return;
  if (choice == 'share') {
    await safeShare(context, [file.path], subject: subject, text: subject);
  } else if (choice == 'save') {
    final saved = await safeSaveCopy(context, file);
    if (saved && context.mounted) showSnack(context, 'Saved ${p.basename(file.path)}');
  }
}
