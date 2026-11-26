import 'package:material_ui/material_ui.dart';
import '../data/crm_database.dart';
import 'contacts_screen.dart';
import 'activities_screen.dart';
import 'settings_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int index = 0;
  @override
  Widget build(BuildContext context) {
    final pages = [
      const DashboardScreen(),
      const ContactsScreen(),
      const ActivitiesScreen(),
      const SettingsScreen(),
    ];
    return Scaffold(
      body: SafeArea(child: pages[index]),
      bottomNavigationBar: NavigationBar(
        selectedIndex: index,
        onDestinationSelected: (v) => setState(() => index = v),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.dashboard_rounded), label: 'Overview'),
          NavigationDestination(icon: Icon(Icons.people_alt_rounded), label: 'Contacts'),
          NavigationDestination(icon: Icon(Icons.task_alt_rounded), label: 'Activities'),
          NavigationDestination(icon: Icon(Icons.settings_rounded), label: 'Settings'),
        ],
      ),
    );
  }
}

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});
  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  late Future<Map<String, int>> counts;

  @override
  void initState() {
    super.initState();
    counts = load();
  }

  Future<Map<String, int>> load() async => {
    'contacts': await CrmDatabase.instance.contactCount(),
    'activities': await CrmDatabase.instance.openActivityCount(),
  };

  Future<void> reload() async {
    final next = load();
    setState(() {
      counts = next;
    });
    await next.catchError((_) => <String, int>{});
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: reload,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const SizedBox(height: 8),
          Row(children: [
            Container(width: 52, height: 52, decoration: BoxDecoration(
              gradient: const LinearGradient(colors: [Color(0xFF7D3BD1), Color(0xFF49208E)]),
              borderRadius: BorderRadius.circular(16)),
              child: const Icon(Icons.auto_awesome, color: Colors.white, size: 29)),
            const SizedBox(width: 14),
            const Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('Anjali CRM AI', style: TextStyle(fontSize: 23, fontWeight: FontWeight.w800)),
              Text('Your relationships, organized.', style: TextStyle(color: Colors.grey)),
            ])),
          ]),
          const SizedBox(height: 26),
          const Text('Your workspace', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
          const SizedBox(height: 12),
          FutureBuilder<Map<String, int>>(
            future: counts,
            builder: (context, snapshot) {
              if (snapshot.hasError) {
                return Card(child: ListTile(
                  leading: Icon(Icons.error_outline, color: Theme.of(context).colorScheme.error),
                  title: const Text('Could not load your numbers'),
                  subtitle: Text('${snapshot.error}'),
                  trailing: TextButton(onPressed: reload, child: const Text('Retry')),
                ));
              }
              // While loading, show a dash rather than a misleading 0.
              String show(String key) => snapshot.connectionState == ConnectionState.done ? '${snapshot.data![key]}' : '–';
              return Row(children: [
                Expanded(child: _MetricCard(title: 'Contacts', value: show('contacts'), icon: Icons.people_alt_rounded)),
                const SizedBox(width: 12),
                Expanded(child: _MetricCard(title: 'Open activities', value: show('activities'), icon: Icons.task_alt_rounded)),
              ]);
            },
          ),
          const SizedBox(height: 24),
          Card(child: Padding(
            padding: const EdgeInsets.all(18),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Row(children: [Icon(Icons.lightbulb_outline, color: Color(0xFF7D3BD1)), SizedBox(width: 8), Text('CRM essentials', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17))]),
              const SizedBox(height: 10),
              const Text('Keep customer details in one place, capture follow-ups, and export your records when needed. Your data is stored locally on this device.'),
              const SizedBox(height: 12),
              Wrap(spacing: 8, runSpacing: 8, children: const [
                _Tag(label: 'Contact management'), _Tag(label: 'Follow-up tracking'), _Tag(label: 'Offline-first'),
              ]),
            ]),
          )),
          const SizedBox(height: 14),
          const Text('Quick start', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
          const SizedBox(height: 10),
          const _QuickCard(icon: Icons.person_add_alt_1, title: 'Add a contact', subtitle: 'Save a customer or business contact'),
          const _QuickCard(icon: Icons.event_note, title: 'Track a follow-up', subtitle: 'Create an activity with a due date'),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  final String title, value;
  final IconData icon;
  const _MetricCard({required this.title, required this.value, required this.icon});
  @override
  Widget build(BuildContext context) => Card(child: Padding(
    padding: const EdgeInsets.all(16),
    child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Icon(icon, color: const Color(0xFF7D3BD1)),
      const SizedBox(height: 14),
      Text(value, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w800)),
      Text(title, style: const TextStyle(color: Colors.grey)),
    ]),
  ));
}
class _Tag extends StatelessWidget {
  final String label;
  const _Tag({required this.label});
  @override
  Widget build(BuildContext context) => Chip(label: Text(label), visualDensity: VisualDensity.compact);
}
class _QuickCard extends StatelessWidget {
  final IconData icon;
  final String title, subtitle;
  const _QuickCard({required this.icon, required this.title, required this.subtitle});
  @override
  Widget build(BuildContext context) => Card(child: ListTile(
    leading: CircleAvatar(backgroundColor: const Color(0xFFF0E7FC), child: Icon(icon, color: const Color(0xFF6427B8))),
    title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
    subtitle: Text(subtitle),
  ));
}
