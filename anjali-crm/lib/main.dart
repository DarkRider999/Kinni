import 'package:material_ui/material_ui.dart';
import 'data/crm_database.dart';
import 'screens/home_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  // Start opening the database while the first frame draws. The screens
  // await it and show an error with Retry if it fails, instead of the app
  // dying on a blank screen before runApp.
  CrmDatabase.instance.database.ignore();
  runApp(const AnjaliCrmApp());
}

class AnjaliCrmApp extends StatelessWidget {
  const AnjaliCrmApp({super.key});

  @override
  Widget build(BuildContext context) {
    const purple = Color(0xFF6427B8);
    return MaterialApp(
      title: 'Anjali CRM AI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: purple, brightness: Brightness.light),
        scaffoldBackgroundColor: const Color(0xFFF8F6FC),
        appBarTheme: const AppBarTheme(centerTitle: false, backgroundColor: Color(0xFFF8F6FC)),
        cardTheme: CardThemeData(elevation: 0, color: Colors.white, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
        inputDecorationTheme: InputDecorationTheme(
          filled: true, fillColor: Colors.white,
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
        ),
      ),
      darkTheme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(seedColor: purple, brightness: Brightness.dark),
        cardTheme: CardThemeData(elevation: 0, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18))),
      ),
      themeMode: ThemeMode.system,
      home: const HomeScreen(),
    );
  }
}
