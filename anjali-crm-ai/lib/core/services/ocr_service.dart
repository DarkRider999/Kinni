import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';

/// On-device OCR with Google ML Kit (free, offline once the model is bundled).
abstract final class OcrService {
  static Future<String> recognize(String imagePath) async {
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final result = await recognizer.processImage(InputImage.fromFilePath(imagePath));
      return result.text;
    } finally {
      await recognizer.close();
    }
  }
}
