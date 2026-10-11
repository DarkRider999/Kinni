import 'dart:io';

import 'package:flutter/services.dart' show rootBundle;
import 'package:path/path.dart' as p;
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../../core/constants/app_assets.dart';
import '../../core/services/file_storage_service.dart';
import '../../core/utils/formatters.dart';
import '../../domain/entities/activity.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/client_document.dart';
import '../../domain/services/report_engine.dart';
import 'export_bundle.dart';

/// PDF reports: portfolio summary and single-client profile (FR REP-04).
abstract final class PdfExporter {
  static const _primary = PdfColor.fromInt(0xFF6C63FF);
  static const _pink = PdfColor.fromInt(0xFFFF6B9D);

  static Future<pw.MemoryImage?> _logo() async {
    try {
      final data = await rootBundle.load(AppAssets.logo);
      return pw.MemoryImage(data.buffer.asUint8List());
    } catch (_) {
      return null;
    }
  }

  static pw.Widget _header(pw.MemoryImage? logo, String title, String subtitle) => pw.Container(
        padding: const pw.EdgeInsets.only(bottom: 12),
        decoration: const pw.BoxDecoration(border: pw.Border(bottom: pw.BorderSide(color: _primary, width: 2))),
        child: pw.Row(children: [
          if (logo != null) pw.ClipOval(child: pw.Image(logo, width: 44, height: 44)),
          if (logo != null) pw.SizedBox(width: 12),
          pw.Expanded(
            child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
              pw.Text(title, style: pw.TextStyle(fontSize: 18, fontWeight: pw.FontWeight.bold, color: _primary)),
              pw.Text(subtitle, style: const pw.TextStyle(fontSize: 10, color: PdfColors.grey700)),
            ]),
          ),
          pw.Text(AppInfo.name, style: const pw.TextStyle(fontSize: 9, color: _pink)),
        ]),
      );

  static pw.Widget _kpi(String label, String value) => pw.Container(
        width: 120,
        padding: const pw.EdgeInsets.all(10),
        decoration: pw.BoxDecoration(color: const PdfColor.fromInt(0xFFF1F0FF), borderRadius: pw.BorderRadius.circular(8)),
        child: pw.Column(crossAxisAlignment: pw.CrossAxisAlignment.start, children: [
          pw.Text(value, style: pw.TextStyle(fontSize: 16, fontWeight: pw.FontWeight.bold, color: _primary)),
          pw.Text(label, style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey700)),
        ]),
      );

  static pw.Widget _table(List<String> headers, List<List<String>> rows) => pw.TableHelper.fromTextArray(
        headers: headers,
        data: rows,
        headerStyle: pw.TextStyle(color: PdfColors.white, fontWeight: pw.FontWeight.bold, fontSize: 8),
        headerDecoration: const pw.BoxDecoration(color: _primary),
        cellStyle: const pw.TextStyle(fontSize: 8),
        oddRowDecoration: const pw.BoxDecoration(color: PdfColor.fromInt(0xFFF8FAFC)),
        cellAlignment: pw.Alignment.centerLeft,
      );

  static Future<File> exportReport(ExportBundle b) async {
    final logo = await _logo();
    final doc = pw.Document(title: 'Anjali CRM Report', author: b.agentName);
    final k = b.kpis;
    List<List<String>> group(ReportGroup g) => ReportEngine.groupBy(g, b.clients, b.products)
        .map((r) => [r.label, '${r.leads}', '${r.converted}', Fmt.percent(r.conversionRate), Fmt.aed(r.disbursed)])
        .toList();
    const groupHeaders = ['Group', 'Leads', 'Converted', 'Conv. %', 'Disbursed'];

    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(28),
      header: (_) => _header(logo, 'Sales Performance Report', '${b.period.label} · ${b.agentName} · generated ${Fmt.dateTime(b.generatedAt)}'),
      footer: (ctx) => pw.Align(
        alignment: pw.Alignment.centerRight,
        child: pw.Text('Page ${ctx.pageNumber} of ${ctx.pagesCount}', style: const pw.TextStyle(fontSize: 8, color: PdfColors.grey600)),
      ),
      build: (_) => [
        pw.SizedBox(height: 12),
        pw.Wrap(spacing: 8, runSpacing: 8, children: [
          _kpi('Total leads', '${k.total}'),
          _kpi('Approval rate', Fmt.percent(k.approvalRate)),
          _kpi('Rejection rate', Fmt.percent(k.rejectionRate)),
          _kpi('Conversion rate', Fmt.percent(k.conversionRate)),
          _kpi('Avg followups / lead', k.avgFollowups.toStringAsFixed(1)),
          _kpi('Disbursed', Fmt.aedCompact(k.disbursedAmount)),
          _kpi('Overdue followups', '${k.overdueFollowups}'),
          _kpi('Docs pending', '${k.documentsPending}'),
        ]),
        pw.SizedBox(height: 16),
        for (final g in ReportGroup.values) ...[
          pw.Text('By ${g.label}', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
          pw.SizedBox(height: 4),
          _table(groupHeaders, group(g)),
          pw.SizedBox(height: 12),
        ],
        pw.NewPage(),
        pw.Text('All leads (${b.clients.length})', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 4),
        _table(
          const ['Name', 'Phone', 'Product', 'Status', 'Salary', 'Source', 'Created'],
          [
            for (final c in b.clients)
              [c.name, c.phone, b.productOf(c), c.status.label, Fmt.aed(c.monthlySalary), c.leadSource.label, Fmt.date(c.createdAt)],
          ],
        ),
      ],
    ));
    final dir = await FileStore.exportsDir();
    final f = File(p.join(dir.path, 'Anjali_CRM_Report_${Fmt.fileStamp(b.generatedAt)}.pdf'));
    await f.writeAsBytes(await doc.save(), flush: true);
    return f;
  }

  /// One-page client profile with documents and timeline.
  static Future<File> exportClient({
    required Client client,
    required String productName,
    required List<ClientDocument> documents,
    required List<Activity> activities,
    required int score,
    required String agentName,
  }) async {
    final logo = await _logo();
    final doc = pw.Document(title: client.name, author: agentName);
    String v(Object? x) => x == null || '$x'.isEmpty ? '—' : '$x';
    doc.addPage(pw.MultiPage(
      pageFormat: PdfPageFormat.a4,
      margin: const pw.EdgeInsets.all(28),
      header: (_) => _header(logo, client.name, 'Client profile · prepared by $agentName · ${Fmt.dateTime(DateTime.now())}'),
      build: (_) => [
        pw.SizedBox(height: 10),
        pw.Wrap(spacing: 8, runSpacing: 8, children: [
          _kpi('Status', client.status.label),
          _kpi('Lead score', '$score / 100'),
          _kpi('Product', productName.isEmpty ? '—' : productName),
          _kpi('Requested', Fmt.aed(client.requestedAmount)),
        ]),
        pw.SizedBox(height: 14),
        _table(const ['Field', 'Value'], [
          ['Phone', client.phone],
          ['WhatsApp', client.whatsappNumber],
          ['Email', v(client.email)],
          ['Company', v(client.company)],
          ['Job title', v(client.jobTitle)],
          ['Nationality', v(client.nationality)],
          ['Monthly salary', Fmt.aed(client.monthlySalary)],
          ['Lead source', client.leadSource.label],
          ['Priority', client.priority.label],
          ['Location', v(client.location)],
          ['Next followup', client.nextFollowupAt == null ? '—' : Fmt.dateTime(client.nextFollowupAt!)],
          ['Remarks', v(client.remarks)],
        ]),
        pw.SizedBox(height: 14),
        pw.Text('Documents', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 4),
        _table(const ['Document', 'Status', 'Note'], [for (final d in documents) [d.displayName, d.status.label, v(d.note)]]),
        pw.SizedBox(height: 14),
        pw.Text('Timeline', style: pw.TextStyle(fontSize: 12, fontWeight: pw.FontWeight.bold)),
        pw.SizedBox(height: 4),
        _table(const ['When', 'Event', 'Detail'], [
          for (final a in activities.take(40)) [Fmt.dateTime(a.at), a.title, v(a.detail)],
        ]),
      ],
    ));
    final dir = await FileStore.clientDir(client.id);
    final f = File(p.join(dir.path, 'Profile_${client.name.replaceAll(RegExp(r'[^A-Za-z0-9]+'), '_')}_${Fmt.fileStamp(DateTime.now())}.pdf'));
    await f.writeAsBytes(await doc.save(), flush: true);
    return f;
  }
}
