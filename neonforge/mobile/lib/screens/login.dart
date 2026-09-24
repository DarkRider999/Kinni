import 'package:flutter/material.dart';

import '../state.dart';
import '../theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});
  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _email = TextEditingController();
  String _plan = 'pro';
  bool _busy = false;
  String? _error;

  Future<void> _submit() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await SessionScope.of(context).login(_email.text.trim(), _plan);
    } catch (e) {
      setState(() => _error = '$e');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
              Row(children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: const SweepGradient(colors: [NF.cyan, NF.magenta, NF.cyan]),
                    boxShadow: NF.glow(),
                  ),
                  alignment: Alignment.center,
                  child: const Text('N', style: TextStyle(color: NF.bg, fontWeight: FontWeight.w800, fontSize: 20)),
                ),
                const SizedBox(width: 12),
                Text('NeonForge AI', style: Theme.of(context).textTheme.headlineSmall),
              ]),
              const SizedBox(height: 8),
              const Text('Studio-grade AI photo & video editing — one file or thousands.',
                  style: TextStyle(color: NF.text2)),
              const SizedBox(height: 24),
              TextField(
                key: const Key('email'),
                controller: _email,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(labelText: 'Email'),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 16),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'free', label: Text('Free')),
                  ButtonSegment(value: 'pro', label: Text('Pro')),
                  ButtonSegment(value: 'studio', label: Text('Studio')),
                ],
                selected: {_plan},
                onSelectionChanged: (s) => setState(() => _plan = s.first),
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: NF.red)),
              ],
              const SizedBox(height: 20),
              FilledButton(
                key: const Key('continue'),
                onPressed: _busy || !_email.text.contains('@') ? null : _submit,
                child: Text(_busy ? 'Signing in…' : 'Continue'),
              ),
              const SizedBox(height: 12),
              const Text('Development sign-in. Production uses Google / Apple / email OTP.',
                  style: TextStyle(color: NF.text2, fontSize: 12)),
            ]),
          ),
        ),
      ),
    );
  }
}
