import 'dart:io';

import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

/// Combines scanned page images into one A4 PDF (one image per page).
abstract final class ScanPdf {
  static Future<File> fromImages(List<String> imagePaths, {String name = 'scan'}) async {
    final doc = pw.Document();
    for (final path in imagePaths) {
      final img = pw.MemoryImage(await File(path).readAsBytes());
      doc.addPage(pw.Page(
        pageFormat: PdfPageFormat.a4,
        margin: const pw.EdgeInsets.all(16),
        build: (_) => pw.Center(child: pw.Image(img, fit: pw.BoxFit.contain)),
      ));
    }
    final dir = await getTemporaryDirectory();
    final out = File(p.join(dir.path, '${name}_${DateTime.now().millisecondsSinceEpoch}.pdf'));
    await out.writeAsBytes(await doc.save(), flush: true);
    return out;
  }
}
