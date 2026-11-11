import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:google_mlkit_text_recognition/google_mlkit_text_recognition.dart';
import 'package:image_picker/image_picker.dart';
import 'package:permission_handler/permission_handler.dart';

import '../../core/services/permission_service.dart';
import '../../core/widgets/common.dart';
import '../../domain/services/business_card_parser.dart';

/// Business-card scanner (FR CLI-03): camera preview → capture → on-device
/// OCR → editable review. Pops the reviewed [ParsedCard].
class CardScannerScreen extends StatefulWidget {
  const CardScannerScreen({super.key});

  /// Pushes the scanner and returns the reviewed card (null when cancelled).
  static Future<ParsedCard?> scan(BuildContext context) =>
      Navigator.of(context).push<ParsedCard>(MaterialPageRoute(builder: (_) => const CardScannerScreen()));

  @override
  State<CardScannerScreen> createState() => _CardScannerScreenState();
}

class _CardScannerScreenState extends State<CardScannerScreen> with WidgetsBindingObserver {
  CameraController? _camera;
  String? _cameraError;
  bool _busy = false;
  ParsedCard? _parsed;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) => _initCamera());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _camera?.dispose();
    super.dispose();
  }

  /// Releases the camera in the background and re-opens it on resume.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final c = _camera;
    if (c == null || !c.value.isInitialized) return;
    if (state == AppLifecycleState.inactive) {
      _camera = null;
      c.dispose();
    } else if (state == AppLifecycleState.resumed && _parsed == null) {
      _initCamera();
    }
  }

  Future<void> _initCamera() async {
    final ok = await Permissions.ensure(context, Permission.camera, rationale: 'The camera is used to scan business cards.');
    if (!mounted) return;
    if (!ok) {
      setState(() => _cameraError = 'Camera permission is needed to scan. You can still pick a photo from the gallery.');
      return;
    }
    try {
      final cams = await availableCameras();
      if (cams.isEmpty) throw CameraException('none', 'No camera found');
      final back = cams.firstWhere((c) => c.lensDirection == CameraLensDirection.back, orElse: () => cams.first);
      final controller = CameraController(back, ResolutionPreset.high, enableAudio: false);
      await controller.initialize();
      if (!mounted) {
        await controller.dispose();
        return;
      }
      setState(() {
        _camera = controller;
        _cameraError = null;
      });
    } on CameraException catch (e) {
      if (mounted) setState(() => _cameraError = 'Camera unavailable (${e.description ?? e.code}).');
    }
  }

  Future<void> _capture() async {
    final c = _camera;
    if (c == null || !c.value.isInitialized || c.value.isTakingPicture) return;
    setState(() => _busy = true);
    try {
      final shot = await c.takePicture();
      await _recognise(shot.path);
    } on CameraException catch (e) {
      if (mounted) showSnack(context, 'Capture failed: ${e.description ?? e.code}', error: true);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _pickGallery() async {
    final img = await ImagePicker().pickImage(source: ImageSource.gallery, maxWidth: 2400);
    if (img == null || !mounted) return;
    setState(() => _busy = true);
    try {
      await _recognise(img.path);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  /// Runs Latin-script OCR and parses the text into contact fields.
  Future<void> _recognise(String path) async {
    final recognizer = TextRecognizer(script: TextRecognitionScript.latin);
    try {
      final result = await recognizer.processImage(InputImage.fromFilePath(path));
      final card = BusinessCardParser.parse(result.text);
      if (!mounted) return;
      if (card.isEmpty) {
        showSnack(context, 'No contact details found. Try again with better light.', error: true);
        return;
      }
      setState(() => _parsed = card);
    } catch (_) {
      if (mounted) showSnack(context, 'Could not read the card', error: true);
    } finally {
      await recognizer.close();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_parsed != null) {
      return _CardReview(
        card: _parsed!,
        onRetake: () => setState(() => _parsed = null),
      );
    }
    final c = _camera;
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        title: const Text('Scan business card'),
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        actions: [
          IconButton(tooltip: 'Pick from gallery', onPressed: _busy ? null : _pickGallery, icon: const Icon(Icons.photo_library_rounded)),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Center(
              child: _cameraError != null
                  ? Padding(
                      padding: const EdgeInsets.all(24),
                      child: Text(_cameraError!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
                    )
                  : (c == null || !c.value.isInitialized)
                      ? const CircularProgressIndicator()
                      : Stack(
                          alignment: Alignment.center,
                          children: [
                            CameraPreview(c),
                            // Card-shaped guide frame.
                            FractionallySizedBox(
                              widthFactor: .86,
                              child: AspectRatio(
                                aspectRatio: 1.75,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.white.withValues(alpha: .85), width: 2),
                                    borderRadius: BorderRadius.circular(14),
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
            ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 24),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  IconButton.filledTonal(
                    tooltip: 'Gallery',
                    onPressed: _busy ? null : _pickGallery,
                    icon: const Icon(Icons.photo_library_rounded),
                  ),
                  SizedBox(
                    width: 74,
                    height: 74,
                    child: _busy
                        ? const Center(child: CircularProgressIndicator(color: Colors.white))
                        : IconButton.filled(
                            tooltip: 'Capture',
                            onPressed: (c != null && c.value.isInitialized) ? _capture : null,
                            icon: const Icon(Icons.camera_alt_rounded, size: 34),
                          ),
                  ),
                  const SizedBox(width: 48),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Editable review of the OCR result before it fills the lead form.
class _CardReview extends StatefulWidget {
  const _CardReview({required this.card, required this.onRetake});
  final ParsedCard card;
  final VoidCallback onRetake;

  @override
  State<_CardReview> createState() => _CardReviewState();
}

class _CardReviewState extends State<_CardReview> {
  late final _name = TextEditingController(text: widget.card.name);
  late final _phones = [for (final p in widget.card.phones) TextEditingController(text: p)];
  late final _email = TextEditingController(text: widget.card.email);
  late final _company = TextEditingController(text: widget.card.company);
  late final _title = TextEditingController(text: widget.card.jobTitle);

  @override
  void dispose() {
    for (final c in [_name, _email, _company, _title, ..._phones]) {
      c.dispose();
    }
    super.dispose();
  }

  String? _t(TextEditingController c) => c.text.trim().isEmpty ? null : c.text.trim();

  void _done() => Navigator.pop(
        context,
        ParsedCard(
          name: _t(_name),
          phones: [for (final p in _phones) ?_t(p)],
          email: _t(_email),
          company: _t(_company),
          jobTitle: _t(_title),
          website: widget.card.website,
        ),
      );

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Review card')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextField(controller: _name, decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.person_rounded))),
            for (var i = 0; i < _phones.length; i++) ...[
              const SizedBox(height: 12),
              TextField(
                controller: _phones[i],
                keyboardType: TextInputType.phone,
                decoration: InputDecoration(labelText: 'Phone ${i + 1}', prefixIcon: const Icon(Icons.phone_rounded)),
              ),
            ],
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() => _phones.add(TextEditingController())),
                icon: const Icon(Icons.add_rounded),
                label: const Text('Add phone'),
              ),
            ),
            TextField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_rounded)),
            ),
            const SizedBox(height: 12),
            TextField(controller: _company, decoration: const InputDecoration(labelText: 'Company', prefixIcon: Icon(Icons.business_rounded))),
            const SizedBox(height: 12),
            TextField(controller: _title, decoration: const InputDecoration(labelText: 'Job title', prefixIcon: Icon(Icons.badge_rounded))),
            const SizedBox(height: 24),
            Row(
              children: [
                Expanded(child: OutlinedButton.icon(onPressed: widget.onRetake, icon: const Icon(Icons.refresh_rounded), label: const Text('Retake'))),
                const SizedBox(width: 12),
                Expanded(child: FilledButton.icon(onPressed: _done, icon: const Icon(Icons.check_rounded), label: const Text('Use details'))),
              ],
            ),
          ],
        ),
      );
}
