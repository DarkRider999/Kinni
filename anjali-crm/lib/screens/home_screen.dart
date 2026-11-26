import 'package:material_ui/material_ui.dart';

import '../data/crm_database.dart';
import '../data/followup_buckets.dart';
import '../data/models.dart';
import '../services/client_actions.dart';
import '../ui/dialogs.dart';
import '../ui/format.dart';
import '../ui/widgets.dart';
import '../widgets/async_body.dart';
import 'client_profile_screen.dart';
import 'clients_screen.dart';
import 'followups_screen.dart';
import 'lead_form_screen.dart';
import 'settings_screen.dart';

/// App shell with the bottom navigation (guide §4).
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _home = 0, _clients = 1, _addLead = 2, _followups = 3;

  int _index = _home;
  Set<LeadStatus> _clientsFilter = const {};
  FollowupBucket _followupBucket = FollowupBucket.today;

  /// Bumped to rebuild a tab with new starting filters.
  int _generation = 0;
  int _overdue = 0;

  @override
  void initState() {
    super.initState();
    _refreshBadge();
  }

  Future<void> _refreshBadge() async {
    try {
      final stats = await CrmDatabase.instance.dashboard();
      if (mounted) setState(() => _overdue = stats.overdue);
    } catch (_) {
      // The badge is a hint; the screens themselves report database errors.
    }
  }

  void _go(int index, {Set<LeadStatus> statuses = const {}, FollowupBucket bucket = FollowupBucket.today}) {
    setState(() {
      _index = index;
      _clientsFilter = statuses;
      _followupBucket = bucket;
      _generation++;
    });
    _refreshBadge();
  }

  @override
  Widget build(BuildContext context) {
    final page = switch (_index) {
      _home => DashboardScreen(
          key: ValueKey('home-$_generation'),
          onOpenClients: (s) => _go(_clients, statuses: s),
          onOpenFollowups: (b) => _go(_followups, bucket: b),
          onChanged: _refreshBadge,
        ),
      _clients => ClientsScreen(key: ValueKey('clients-$_generation'), initialStatuses: _clientsFilter),
      _addLead => LeadFormScreen(key: ValueKey('add-$_generation'), embedded: true),
      _followups => FollowupsScreen(key: ValueKey('followups-$_generation'), initialBucket: _followupBucket, onChanged: _refreshBadge),
      _ => const SettingsScreen(),
    };
    return Scaffold(
      body: SafeArea(child: page),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (v) => _go(v),
        destinations: [
          const NavigationDestination(icon: Icon(Icons.dashboard_rounded), label: 'Home'),
          const NavigationDestination(icon: Icon(Icons.people_alt_rounded), label: 'Clients'),
          const NavigationDestination(icon: Icon(Icons.person_add_alt_1), label: 'Add Lead'),
          NavigationDestination(
            icon: Badge(isLabelVisible: _overdue > 0, label: Text('$_overdue'), child: const Icon(Icons.event_note)),
            label: 'Followups',
          ),
          const NavigationDestination(icon: Icon(Icons.settings_rounded), label: 'Settings'),
        ],
      ),
    );
  }
}

class _DashboardData {
  _DashboardData(this.stats, this.tasks);
  final DashboardStats stats;

  /// Open followups due today or overdue.
  final List<Followup> tasks;
}

/// Your day at a glance (guide §5).
class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key, required this.onOpenClients, required this.onOpenFollowups, required this.onChanged});
  final ValueChanged<Set<LeadStatus>> onOpenClients;
  final ValueChanged<FollowupBucket> onOpenFollowups;
  final VoidCallback onChanged;

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _db = CrmDatabase.instance;
  late Future<_DashboardData> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<_DashboardData> _load() async {
    final now = _db.now;
    final stats = await _db.dashboard();
    final open = (await _db.followups()).where((f) {
      final b = bucketFor(f, now);
      return b == FollowupBucket.overdue || b == FollowupBucket.today;
    }).toList();
    return _DashboardData(stats, open);
  }

  Future<void> _reload() async {
    if (!mounted) return;
    final next = _load();
    setState(() {
      _future = next;
    });
    widget.onChanged();
    await next.then((_) {}, onError: (_) {});
  }

  Future<void> _complete(Followup f) async {
    final outcome = await showCompleteFollowupDialog(context);
    if (outcome == null) return;
    try {
      await _db.completeFollowup(f.id!, outcome: outcome);
      if (mounted) showSnack(context, 'Followup completed.');
    } catch (e) {
      if (mounted) showSnack(context, 'Could not save: $e');
    }
    await _reload();
  }

  Future<Client?> _clientOf(Followup f) async {
    final c = f.clientId == null ? null : await _db.client(f.clientId!);
    if (c == null && mounted) showSnack(context, 'This followup has no client.');
    return c;
  }

  static String _greeting(DateTime now) => now.hour < 12 ? 'Good morning' : now.hour < 17 ? 'Good afternoon' : 'Good evening';

  @override
  Widget build(BuildContext context) => RefreshIndicator(
        onRefresh: _reload,
        child: AsyncBody<_DashboardData>(
          future: _future,
          onRetry: _reload,
          builder: (context, d) {
            final s = d.stats;
            final now = DateTime.now();
            final cards = <_Metric>[
              _Metric('Total leads', '${s.totalLeads}', Icons.groups, () => widget.onOpenClients(const {})),
              for (final st in LeadStatus.values) _Metric(st.label, '${s.count(st)}', Icons.circle, () => widget.onOpenClients({st}), color: statusColor(st)),
              _Metric('Followups today', '${s.followupsToday}', Icons.today, () => widget.onOpenFollowups(FollowupBucket.today)),
              _Metric('Overdue', '${s.overdue}', Icons.warning_amber, () => widget.onOpenFollowups(FollowupBucket.overdue), color: s.overdue > 0 ? Colors.red : null),
              _Metric('Conversions (month)', '${s.conversionsThisMonth}', Icons.trending_up,
                  () => widget.onOpenClients({LeadStatus.approved, LeadStatus.disbursed})),
              _Metric('Disbursed (month)', aed(s.disbursedThisMonth), Icons.payments_outlined, () => widget.onOpenClients({LeadStatus.disbursed})),
            ];
            return ListView(physics: const AlwaysScrollableScrollPhysics(), padding: const EdgeInsets.all(16), children: [
              Row(children: [
                Container(
                  width: 52,
                  height: 52,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(colors: [Color(0xFF7D3BD1), Color(0xFF49208E)]),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: const Icon(Icons.auto_awesome, color: Colors.white, size: 29),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                    Text(_greeting(now), style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w800)),
                    Text(dateLabel(now), style: const TextStyle(color: Colors.grey)),
                  ]),
                ),
              ]),
              const SizedBox(height: 20),
              const Text('Pipeline at a glance', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              const SizedBox(height: 10),
              LayoutBuilder(builder: (context, box) {
                final perRow = box.maxWidth >= 720 ? 4 : box.maxWidth >= 480 ? 3 : 2;
                final w = (box.maxWidth - (perRow - 1) * 8) / perRow;
                return Wrap(spacing: 8, runSpacing: 8, children: [for (final m in cards) SizedBox(width: w, child: _MetricCard(m))]);
              }),
              const SizedBox(height: 20),
              Row(children: [
                const Expanded(child: Text("Today's tasks", style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold))),
                TextButton(onPressed: () => widget.onOpenFollowups(FollowupBucket.today), child: const Text('All followups')),
              ]),
              if (d.tasks.isEmpty)
                const Card(
                  child: ListTile(
                    leading: Icon(Icons.celebration_outlined),
                    title: Text('Nothing due today'),
                    subtitle: Text("Schedule a followup from a client's profile."),
                  ),
                ),
              for (final f in d.tasks)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: FollowupCard(
                    followup: f,
                    now: now,
                    onOpenClient: (id) async {
                      await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ClientProfileScreen(clientId: id)));
                      await _reload();
                    },
                    onCall: (f) async {
                      final c = await _clientOf(f);
                      if (c != null && context.mounted) await ClientActions.call(context, c, onLogged: _reload);
                    },
                    onWhatsApp: (f) async {
                      final c = await _clientOf(f);
                      if (c != null && context.mounted) await ClientActions.whatsapp(context, c);
                    },
                    onComplete: _complete,
                  ),
                ),
            ]);
          },
        ),
      );
}

class _Metric {
  _Metric(this.label, this.value, this.icon, this.onTap, {this.color});
  final String label;
  final String value;
  final IconData icon;
  final VoidCallback onTap;
  final Color? color;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.m);
  final _Metric m;

  @override
  Widget build(BuildContext context) => Card(
        margin: EdgeInsets.zero,
        child: InkWell(
          borderRadius: BorderRadius.circular(18),
          onTap: m.onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Icon(m.icon, size: m.icon == Icons.circle ? 12 : 20, color: m.color ?? brandPurple),
              const SizedBox(height: 8),
              Text(m.value, style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: m.color)),
              Text(m.label, style: const TextStyle(color: Colors.grey, fontSize: 12), maxLines: 1, overflow: TextOverflow.ellipsis),
            ]),
          ),
        ),
      );
}
