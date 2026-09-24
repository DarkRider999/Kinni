import 'package:flutter/material.dart';

import 'api/client.dart';
import 'screens/home.dart';
import 'screens/login.dart';
import 'state.dart';
import 'theme.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(NeonForgeApp(session: Session(ApiClient())..restore()));
}

class NeonForgeApp extends StatelessWidget {
  const NeonForgeApp({super.key, required this.session});
  final Session session;

  @override
  Widget build(BuildContext context) {
    return SessionScope(
      session: session,
      child: MaterialApp(
        title: 'NeonForge AI',
        debugShowCheckedModeBanner: false,
        theme: neonTheme(),
        home: ListenableBuilder(
          listenable: session,
          builder: (context, _) {
            if (!session.ready) return const Scaffold(body: Center(child: CircularProgressIndicator()));
            return session.me == null ? const LoginScreen() : const HomeShell();
          },
        ),
      ),
    );
  }
}
