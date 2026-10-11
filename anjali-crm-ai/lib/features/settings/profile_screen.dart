import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:path/path.dart' as p;

import '../../core/services/file_storage_service.dart';
import '../../core/utils/id.dart';
import '../../core/utils/validators.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../providers/app_providers.dart';
import 'settings_widgets.dart';

/// Edit Anjali's name, mobile number and profile photo (FR-SET).
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  final _form = GlobalKey<FormState>();
  late final _name = TextEditingController(text: ref.read(profileProvider).name);
  late final _mobile = TextEditingController(text: ref.read(profileProvider).mobile);
  late String? _photo = ref.read(profileProvider).photoPath;
  bool _saving = false;

  @override
  void dispose() {
    _name.dispose();
    _mobile.dispose();
    super.dispose();
  }

  Future<void> _pick(ImageSource source) async {
    final x = await ImagePicker().pickImage(source: source, maxWidth: 900, imageQuality: 85);
    if (x == null) return;
    final String dest;
    try {
      final dir = await FileStore.profileDir();
      final ext = p.extension(x.path).isEmpty ? '.jpg' : p.extension(x.path);
      dest = p.join(dir.path, 'profile_${newId().substring(0, 8)}$ext');
      await File(x.path).copy(dest);
    } catch (e) {
      if (mounted) showSnack(context, 'Could not save the photo: $e', error: true);
      return;
    }
    if (_photo != null && _photo != ref.read(profileProvider).photoPath) await FileStore.deleteQuietly(_photo);
    if (mounted) setState(() => _photo = dest);
  }

  Future<void> _choosePhoto() async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      showDragHandle: true,
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          ListTile(leading: const Icon(Icons.photo_library_outlined), title: const Text('Choose from gallery'), onTap: () => Navigator.pop(c, 'gallery')),
          ListTile(leading: const Icon(Icons.photo_camera_outlined), title: const Text('Take a photo'), onTap: () => Navigator.pop(c, 'camera')),
          if (_photo != null)
            ListTile(leading: const Icon(Icons.delete_outline_rounded), title: const Text('Remove photo'), onTap: () => Navigator.pop(c, 'remove')),
        ]),
      ),
    );
    switch (choice) {
      case 'gallery':
        await _pick(ImageSource.gallery);
      case 'camera':
        await _pick(ImageSource.camera);
      case 'remove':
        setState(() => _photo = null);
    }
  }

  Future<void> _save() async {
    if (!_form.currentState!.validate()) return;
    setState(() => _saving = true);
    final old = ref.read(profileProvider);
    await ref.read(settingsStoreProvider).setProfile(old.copyWith(name: _name.text.trim(), mobile: _mobile.text.trim(), photoPath: _photo));
    if (old.photoPath != null && old.photoPath != _photo) await FileStore.deleteQuietly(old.photoPath);
    ref.read(profileVersionProvider.notifier).bump();
    if (!mounted) return;
    showSnack(context, 'Profile saved');
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final initials = _name.text.trim().isEmpty ? 'A' : _name.text.trim()[0].toUpperCase();
    return SettingsPage(
      title: 'Profile',
      children: [
        const SizedBox(height: 12),
        Center(
          child: Stack(
            children: [
              PersonAvatar(photoPath: _photo, initials: initials, size: 116, heroTag: 'profile-photo'),
              Positioned(
                right: 0,
                bottom: 0,
                child: IconButton.filled(onPressed: _choosePhoto, icon: const Icon(Icons.photo_camera_rounded), tooltip: 'Change photo'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        GlassCard(
          child: Form(
            key: _form,
            child: Column(children: [
              TextFormField(
                controller: _name,
                textCapitalization: TextCapitalization.words,
                decoration: const InputDecoration(labelText: 'Name', prefixIcon: Icon(Icons.person_outline_rounded)),
                validator: Validators.name,
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _mobile,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(labelText: 'Mobile', prefixIcon: Icon(Icons.phone_outlined)),
                validator: Validators.optionalPhone,
              ),
            ]),
          ),
        ),
        const SizedBox(height: 20),
        GradientButton(label: 'Save', icon: Icons.check_rounded, loading: _saving, onPressed: _save),
      ],
    );
  }
}
