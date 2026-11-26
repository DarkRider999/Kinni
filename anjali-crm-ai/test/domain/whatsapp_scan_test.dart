import 'dart:io';

import 'package:anjali_crm_ai/features/documents/whatsapp_files_screen.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

void main() {
  test('lists supported WhatsApp files newest first, skipping hidden, unsupported and sub-folders', () {
    final tmp = Directory.systemTemp.createTempSync('wa_scan_');
    addTearDown(() => tmp.deleteSync(recursive: true));
    final images = Directory(p.join(tmp.path, 'WhatsApp Images'))..createSync();
    final docs = Directory(p.join(tmp.path, 'WhatsApp Documents'))..createSync();
    Directory(p.join(images.path, 'Sent')).createSync();
    File(p.join(images.path, 'Sent', 'outgoing.jpg')).writeAsStringSync('x');

    File write(Directory d, String name, DateTime when) =>
        File(p.join(d.path, name))
          ..writeAsStringSync('x')
          ..setLastModifiedSync(when);
    write(images, 'IMG-old.jpg', DateTime(2026, 1, 1));
    write(images, '.nomedia', DateTime(2026, 9, 1));
    write(docs, 'salary.PDF', DateTime(2026, 10, 1));
    write(docs, 'notes.docx', DateTime(2026, 10, 2));

    final found = WhatsAppFilesScreen.scan(const ['pdf', 'jpg', 'jpeg', 'png', 'webp'], from: [
      WhatsAppFolder('WhatsApp Images', [images.path, p.join(tmp.path, 'missing')]),
      WhatsAppFolder('WhatsApp Documents', [docs.path]),
    ]);

    expect(found.map((f) => p.basename(f.file.path)), ['salary.PDF', 'IMG-old.jpg']);
    expect(found.first.folder, 'WhatsApp Documents');
    expect(found.first.isImage, isFalse);
  });
}
