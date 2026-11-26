import 'dart:io';

import 'package:excel/excel.dart';
import 'package:path/path.dart' as p;

import '../../core/services/file_storage_service.dart';
import '../../core/utils/formatters.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/followup.dart';
import 'export_bundle.dart';

/// Excel workbook with six sheets (FR REP-03).
abstract final class ExcelExporter {
  static const leadHeaders = [
    'Name', 'Phone', 'WhatsApp', 'Email', 'Company', 'Job Title', 'Nationality', 'Monthly Salary (AED)',
    'Product', 'Lead Source', 'Status', 'Priority', 'Rating', 'Location', 'Requested (AED)', 'Approved (AED)',
    'Disbursed (AED)', 'Next Followup', 'Created', 'Status Changed', 'Remarks',
  ];

  static CellValue? _t(String? v) => (v == null || v.isEmpty) ? null : TextCellValue(v);
  static CellValue? _d(double? v) => v == null ? null : DoubleCellValue(v);

  static List<CellValue?> leadRow(Client c, ExportBundle b) => [
        TextCellValue(c.name),
        TextCellValue(c.phone),
        _t(c.whatsapp),
        _t(c.email),
        _t(c.company),
        _t(c.jobTitle),
        _t(c.nationality),
        _d(c.monthlySalary),
        _t(b.productOf(c)),
        TextCellValue(c.leadSource.label),
        TextCellValue(c.status.label),
        TextCellValue(c.priority.label),
        IntCellValue(c.rating),
        _t(c.location),
        _d(c.requestedAmount),
        _d(c.approvedAmount),
        _d(c.disbursedAmount),
        _t(c.nextFollowupAt == null ? null : Fmt.dateTime(c.nextFollowupAt!)),
        TextCellValue(Fmt.date(c.createdAt)),
        TextCellValue(Fmt.date(c.statusChangedAt)),
        _t(c.remarks),
      ];

  static void _header(Excel x, String sheet, List<String> headers) {
    x.appendRow(sheet, [for (final h in headers) TextCellValue(h)]);
    final s = x[sheet];
    for (var i = 0; i < headers.length; i++) {
      s.cell(CellIndex.indexByColumnRow(columnIndex: i, rowIndex: 0)).cellStyle = CellStyle(
        bold: true,
        backgroundColorHex: ExcelColor.fromHexString('#6C63FF'),
        fontColorHex: ExcelColor.white,
      );
      s.setColumnWidth(i, i == 0 ? 26 : 18);
    }
  }

  static void _leadsSheet(Excel x, String name, List<Client> rows, ExportBundle b) {
    _header(x, name, leadHeaders);
    for (final c in rows) {
      x.appendRow(name, leadRow(c, b));
    }
  }

  static List<int> buildBytes(ExportBundle b) {
    final x = Excel.createExcel();
    final defaultSheet = x.getDefaultSheet();
    _leadsSheet(x, 'All Leads', b.clients, b);
    _leadsSheet(x, 'Approved', b.approved, b);
    _leadsSheet(x, 'Rejected', b.rejected, b);

    const docSheet = 'Documents Pending';
    _header(x, docSheet, const ['Name', 'Phone', 'Product', 'Status', 'Pending Documents', 'Next Followup']);
    for (final c in b.documentsPending) {
      x.appendRow(docSheet, [
        TextCellValue(c.name),
        TextCellValue(c.phone),
        _t(b.productOf(c)),
        TextCellValue(c.status.label),
        _t(b.pendingDocsFor(c.id).join(', ')),
        _t(c.nextFollowupAt == null ? null : Fmt.dateTime(c.nextFollowupAt!)),
      ]);
    }

    const fuSheet = 'Followups';
    _header(x, fuSheet, const ['Client', 'Phone', 'Due', 'Status', 'Completed', 'Note']);
    final fus = [...b.followups]..sort((a, c) => a.dueAt.compareTo(c.dueAt));
    for (final Followup f in fus) {
      final c = b.clientById[f.clientId];
      if (c == null) continue;
      x.appendRow(fuSheet, [
        TextCellValue(c.name),
        TextCellValue(c.phone),
        TextCellValue(Fmt.dateTime(f.dueAt)),
        TextCellValue(f.isPending ? (f.isOverdue(b.generatedAt) ? 'Overdue' : 'Pending') : f.status.name),
        _t(f.completedAt == null ? null : Fmt.dateTime(f.completedAt!)),
        _t(f.note),
      ]);
    }

    _leadsSheet(x, 'Disbursed', b.disbursed, b);

    if (defaultSheet != null && defaultSheet != 'All Leads') {
      x.setDefaultSheet('All Leads');
      x.delete(defaultSheet);
    }
    final bytes = x.encode();
    if (bytes == null) throw StateError('Excel encoding failed');
    return bytes;
  }

  static Future<File> export(ExportBundle b) async {
    final dir = await FileStore.exportsDir();
    final f = File(p.join(dir.path, 'Anjali_CRM_Report_${Fmt.fileStamp(b.generatedAt)}.xlsx'));
    await f.writeAsBytes(buildBytes(b), flush: true);
    return f;
  }
}
