import 'package:flutter/material.dart';
import 'package:package_info_plus/package_info_plus.dart';

import '../../core/constants/app_assets.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import 'settings_widgets.dart';

/// App name, version, licences and the privacy note.
class AboutScreen extends StatelessWidget {
  const AboutScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final t = Theme.of(context).textTheme;
    return SettingsPage(
      title: 'About',
      children: [
        const SizedBox(height: 16),
        const Center(child: AppLogo(size: 110)),
        const SizedBox(height: 14),
        Text(AppInfo.name, textAlign: TextAlign.center, style: t.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
        Text(AppInfo.tagline, textAlign: TextAlign.center, style: t.bodyMedium),
        const SizedBox(height: 4),
        FutureBuilder<PackageInfo>(
          future: PackageInfo.fromPlatform(),
          builder: (_, s) => Text(
            s.hasData ? 'Version ${s.data!.version} (${s.data!.buildNumber})' : ' ',
            textAlign: TextAlign.center,
            style: t.bodySmall,
          ),
        ),
        SettingsGroup(title: 'Privacy', icon: Icons.privacy_tip_outlined, children: const [
          SettingsNote(
            'All your CRM data stays on this device, encrypted with AES-256. The key is kept in the Android Keystore and '
            'the app is protected by your PIN. Cloud sync, when you turn it on, copies data to your own Firebase project only.',
            icon: Icons.lock_outline_rounded,
          ),
        ]),
        SettingsGroup(title: 'Legal', icon: Icons.gavel_rounded, children: [
          SettingsTile(
            icon: Icons.description_outlined,
            title: 'Open-source licences',
            onTap: () => showLicensePage(
              context: context,
              applicationName: AppInfo.name,
              applicationIcon: const Padding(padding: EdgeInsets.all(8), child: AppLogo(size: 64, glow: false)),
            ),
          ),
        ]),
        const SizedBox(height: 16),
        GlassCard(
          child: Text('Made with love for Anjali.', textAlign: TextAlign.center, style: t.bodySmall),
        ),
      ],
    );
  }
}
