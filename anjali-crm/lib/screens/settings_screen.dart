import 'package:material_ui/material_ui.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});
  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}
class _SettingsScreenState extends State<SettingsScreen> {
  bool biometricEnabled = false;
  bool loading = true;
  @override
  void initState() { super.initState(); load(); }
  Future<void> load() async {
    final prefs = await SharedPreferences.getInstance();
    if (mounted) setState(() { biometricEnabled = prefs.getBool('biometric_enabled') ?? false; loading = false; });
  }
  Future<void> toggle(bool value) async {
    if (value) {
      try {
        final auth = LocalAuthentication();
        final can = await auth.canCheckBiometrics || await auth.isDeviceSupported();
        if (!can) {
          if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('No supported device authentication is available.')));
          return;
        }
        final ok = await auth.authenticate(localizedReason: 'Authenticate to enable biometric protection');
        if (!ok) return;
      } catch (_) {
        if (mounted) ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Biometric authentication could not be completed on this device.')));
        return;
      }
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('biometric_enabled', value);
    if (mounted) setState(() => biometricEnabled = value);
  }
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Settings', style: TextStyle(fontWeight: FontWeight.bold))),
    body: ListView(padding: const EdgeInsets.all(16), children: [
      Card(child: ListTile(leading: const Icon(Icons.shield_outlined), title: const Text('Privacy & security'), subtitle: const Text('Local device storage and authentication settings'))),
      Card(child: SwitchListTile(
        secondary: const Icon(Icons.fingerprint), title: const Text('Biometric protection'),
        subtitle: const Text('Stores your preference and tests device authentication. App-wide lock enforcement is not enabled in this initial build.'),
        value: biometricEnabled, onChanged: loading ? null : toggle,
      )),
      const Card(child: ListTile(leading: Icon(Icons.cloud_off_outlined), title: Text('Offline mode'), subtitle: Text('Contacts and activities are stored locally on this device.'))),
      const Card(child: ListTile(leading: Icon(Icons.info_outline), title: Text('Anjali CRM AI'), subtitle: Text('Version 1.0.0 (Build 1)'))),
      const Padding(padding: EdgeInsets.all(12), child: Text('Firebase synchronization, scheduled notifications, contact import, and encrypted backup require environment-specific configuration and are not represented as active in this build.', style: TextStyle(color: Colors.grey))),
    ]),
  );
}
