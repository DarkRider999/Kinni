import 'package:flutter/material.dart';

import '../app_scope.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _form = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _name = TextEditingController();
  bool _register = false;
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    _name.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    final api = AppScope.of(context).api;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      if (_register) {
        await api.register(_email.text.trim(), _password.text, _name.text.trim());
      } else {
        await api.login(_email.text.trim(), _password.text);
      }
    } catch (e) {
      setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _editServer() async {
    final api = AppScope.of(context).api;
    final controller = TextEditingController(text: api.baseUrl);
    final url = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Server address'),
        content: TextField(
          controller: controller,
          keyboardType: TextInputType.url,
          decoration: const InputDecoration(helperText: 'e.g. http://192.168.1.10:3000 or https://api.example.com', helperMaxLines: 2),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.pop(context, controller.text), child: const Text('Save')),
        ],
      ),
    );
    if (url != null && url.trim().isNotEmpty) {
      await api.setBaseUrl(url);
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final api = AppScope.of(context).api;
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Form(
                key: _form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Icon(Icons.schedule, size: 72, color: theme.colorScheme.primary),
                    const SizedBox(height: 12),
                    Text('Am I Late?', textAlign: TextAlign.center, style: theme.textTheme.headlineLarge?.copyWith(fontWeight: FontWeight.bold)),
                    Text('by Roshan', textAlign: TextAlign.center, style: theme.textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Text('Know when to leave. Beat UAE traffic, Salik and DARB.', textAlign: TextAlign.center, style: theme.textTheme.bodyMedium),
                    const SizedBox(height: 32),
                    if (_register) ...[
                      TextFormField(
                        controller: _name,
                        textCapitalization: TextCapitalization.words,
                        decoration: const InputDecoration(labelText: 'Your name', prefixIcon: Icon(Icons.person_outline), border: OutlineInputBorder()),
                      ),
                      const SizedBox(height: 12),
                    ],
                    TextFormField(
                      controller: _email,
                      keyboardType: TextInputType.emailAddress,
                      autofillHints: const [AutofillHints.email],
                      decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(Icons.email_outlined), border: OutlineInputBorder()),
                      validator: (v) => v != null && v.contains('@') ? null : 'Enter a valid email',
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _password,
                      obscureText: true,
                      autofillHints: const [AutofillHints.password],
                      decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock_outline), border: OutlineInputBorder()),
                      validator: (v) => v != null && v.length >= 8 ? null : 'At least 8 characters',
                      onFieldSubmitted: (_) => _submit(),
                    ),
                    if (_error != null) ...[
                      const SizedBox(height: 12),
                      Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                    ],
                    const SizedBox(height: 20),
                    FilledButton(
                      onPressed: _busy ? null : _submit,
                      style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(52)),
                      child: _busy
                          ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2))
                          : Text(_register ? 'Create free account' : 'Sign in'),
                    ),
                    TextButton(
                      onPressed: () => setState(() {
                        _register = !_register;
                        _error = null;
                      }),
                      child: Text(_register ? 'I already have an account' : 'New here? Create a free account'),
                    ),
                    const SizedBox(height: 16),
                    TextButton.icon(
                      onPressed: _editServer,
                      icon: const Icon(Icons.dns_outlined, size: 18),
                      label: Text('Server: ${api.baseUrl}', overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
