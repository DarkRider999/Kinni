import 'package:material_ui/material_ui.dart';

import '../data/crm_database.dart';
import '../data/models.dart';
import '../services/client_actions.dart';
import '../ui/dialogs.dart';
import '../ui/format.dart';
import '../ui/widgets.dart';
import '../widgets/async_body.dart';
import 'client_profile_screen.dart';
import 'lead_form_screen.dart';

/// All leads with search, filters and sort (guide §6).
class ClientsScreen extends StatefulWidget {
  const ClientsScreen({super.key, this.initialStatuses = const {}});

  /// Pre-selected status filter, used when a Home pipeline card is tapped.
  final Set<LeadStatus> initialStatuses;

  @override
  State<ClientsScreen> createState() => _ClientsScreenState();
}

class _ClientsData {
  _ClientsData(this.clients, this.products);
  final List<Client> clients;
  final List<Product> products;
}

class _ClientsScreenState extends State<ClientsScreen> {
  final _search = TextEditingController();
  late Set<LeadStatus> _statuses = {...widget.initialStatuses};
  int? _productId;
  Priority? _priority;
  ClientSort _sort = ClientSort.recentlyUpdated;
  late Future<_ClientsData> _future;
  final _db = CrmDatabase.instance;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<_ClientsData> _load() async => _ClientsData(
        await _db.clients(ClientQuery(search: _search.text, statuses: _statuses, productId: _productId, priority: _priority, sort: _sort)),
        await _db.products(),
      );

  void _reload() {
    if (!mounted) return;
    setState(() {
      _future = _load();
    });
  }

  bool get _filtersOn => _productId != null || _priority != null;

  Future<void> _open(Client c) async {
    await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ClientProfileScreen(clientId: c.id!)));
    _reload();
  }

  Future<void> _edit(Client c) async {
    await Navigator.push(context, MaterialPageRoute<int>(builder: (_) => LeadFormScreen(clientId: c.id)));
    _reload();
  }

  Future<void> _add() async {
    final id = await Navigator.push(context, MaterialPageRoute<int>(builder: (_) => const LeadFormScreen()));
    _reload();
    if (id != null && mounted) {
      await Navigator.push(context, MaterialPageRoute<void>(builder: (_) => ClientProfileScreen(clientId: id)));
      _reload();
    }
  }

  Future<void> _changeStatus(Client c) async {
    final change = await showChangeStatusDialog(context, c);
    if (change == null) return;
    try {
      await _db.changeStatus(c.id!, change.status, amount: change.amount);
      if (mounted) showSnack(context, '${c.name}: ${change.status.label}');
    } catch (e) {
      if (mounted) showSnack(context, 'Could not change status: $e');
    }
    _reload();
  }

  Future<void> _filters(List<Product> products) async {
    final result = await showModalBottomSheet<(int?, Priority?)>(
      context: context,
      builder: (_) => _FilterSheet(products: products, productId: _productId, priority: _priority),
    );
    if (result == null) return;
    _productId = result.$1;
    _priority = result.$2;
    _reload();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(
          title: const Text('Clients', style: TextStyle(fontWeight: FontWeight.bold)),
          actions: [
            PopupMenuButton<ClientSort>(
              tooltip: 'Sort',
              icon: const Icon(Icons.sort),
              initialValue: _sort,
              onSelected: (s) {
                _sort = s;
                _reload();
              },
              itemBuilder: (_) => const [
                PopupMenuItem(value: ClientSort.recentlyUpdated, child: Text('Recently updated')),
                PopupMenuItem(value: ClientSort.nameAsc, child: Text('Name A–Z')),
                PopupMenuItem(value: ClientSort.leadScore, child: Text('Lead score')),
                PopupMenuItem(value: ClientSort.nextFollowup, child: Text('Next followup')),
              ],
            ),
          ],
        ),
        floatingActionButton: FloatingActionButton.extended(onPressed: _add, icon: const Icon(Icons.person_add_alt_1), label: const Text('Add lead')),
        body: AsyncBody<_ClientsData>(
          future: _future,
          onRetry: _reload,
          builder: (context, data) => Column(children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Row(children: [
                Expanded(
                  child: TextField(
                    key: const Key('clients-search'),
                    controller: _search,
                    onChanged: (_) => _reload(),
                    decoration: InputDecoration(
                      prefixIcon: const Icon(Icons.search),
                      hintText: 'Search name, phone or company',
                      suffixIcon: _search.text.isEmpty
                          ? null
                          : IconButton(tooltip: 'Clear search', icon: const Icon(Icons.close), onPressed: () {
                              _search.clear();
                              _reload();
                            }),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Badge(
                  isLabelVisible: _filtersOn,
                  smallSize: 10,
                  child: IconButton.filledTonal(tooltip: 'Filters', onPressed: () => _filters(data.products), icon: const Icon(Icons.tune)),
                ),
              ]),
            ),
            SizedBox(
              height: 40,
              child: ListView(scrollDirection: Axis.horizontal, padding: const EdgeInsets.symmetric(horizontal: 16), children: [
                FilterChip(
                  label: const Text('All'),
                  selected: _statuses.isEmpty,
                  onSelected: (_) {
                    _statuses = {};
                    _reload();
                  },
                ),
                for (final s in LeadStatus.values)
                  Padding(
                    padding: const EdgeInsets.only(left: 6),
                    child: FilterChip(
                      label: Text(s.label),
                      selected: _statuses.contains(s),
                      onSelected: (on) {
                        _statuses = on ? {..._statuses, s} : ({..._statuses}..remove(s));
                        _reload();
                      },
                    ),
                  ),
              ]),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 6, 16, 4),
              child: Align(
                alignment: Alignment.centerRight,
                child: Text('${data.clients.length} client${data.clients.length == 1 ? '' : 's'}', style: const TextStyle(color: Colors.grey)),
              ),
            ),
            Expanded(
              child: data.clients.isEmpty
                  ? _Empty(searching: _search.text.isNotEmpty || _statuses.isNotEmpty || _filtersOn)
                  : ListView.separated(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 90),
                      itemCount: data.clients.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, i) => _ClientCard(
                        client: data.clients[i],
                        onOpen: _open,
                        onEdit: _edit,
                        onChangeStatus: _changeStatus,
                        onCalled: _reload,
                      ),
                    ),
            ),
          ]),
        ),
      );
}

class _ClientCard extends StatelessWidget {
  const _ClientCard({required this.client, required this.onOpen, required this.onEdit, required this.onChangeStatus, required this.onCalled});
  final Client client;
  final ValueChanged<Client> onOpen;
  final ValueChanged<Client> onEdit;
  final ValueChanged<Client> onChangeStatus;
  final VoidCallback onCalled;

  @override
  Widget build(BuildContext context) {
    final c = client;
    final now = DateTime.now();
    final next = c.nextFollowupAt;
    return Dismissible(
      key: ValueKey('client-${c.id}'),
      // Swipe right = WhatsApp, left = Edit (guide §6). The card stays put.
      background: const _SwipeBg(icon: Icons.chat, label: 'WhatsApp', color: Color(0xFF25D366), alignLeft: true),
      secondaryBackground: const _SwipeBg(icon: Icons.edit, label: 'Edit', color: brandPurple, alignLeft: false),
      confirmDismiss: (dir) async {
        if (dir == DismissDirection.startToEnd) {
          await ClientActions.whatsapp(context, c);
        } else {
          onEdit(c);
        }
        return false;
      },
      child: Card(
        child: ListTile(
          onTap: () => onOpen(c),
          onLongPress: () => onChangeStatus(c),
          leading: Initials(c.name),
          title: Text(c.name, style: const TextStyle(fontWeight: FontWeight.w700)),
          subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            const SizedBox(height: 4),
            Wrap(spacing: 6, runSpacing: 4, crossAxisAlignment: WrapCrossAlignment.center, children: [
              StatusChip(c.status),
              if (c.productName != null) Text(c.productName!, style: const TextStyle(fontSize: 12)),
              if (c.priority == Priority.high) const PriorityLabel(Priority.high),
            ]),
            const SizedBox(height: 4),
            Text([c.phone, c.company].where((s) => s.isNotEmpty).join(' · ')),
            if (next != null)
              Text('Next followup ${dateTimeLabel(next)}',
                  style: TextStyle(color: next.isBefore(now) ? Colors.red : brandPurple, fontSize: 12, fontWeight: FontWeight.w600)),
          ]),
          trailing: IconButton(
            tooltip: 'Call ${c.name}',
            icon: const Icon(Icons.call, color: brandPurple),
            onPressed: () => ClientActions.call(context, c, onLogged: onCalled),
          ),
        ),
      ),
    );
  }
}

class _SwipeBg extends StatelessWidget {
  const _SwipeBg({required this.icon, required this.label, required this.color, required this.alignLeft});
  final IconData icon;
  final String label;
  final Color color;
  final bool alignLeft;

  @override
  Widget build(BuildContext context) => Container(
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(18)),
        alignment: alignLeft ? Alignment.centerLeft : Alignment.centerRight,
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ]),
      );
}

class _Empty extends StatelessWidget {
  const _Empty({required this.searching});
  final bool searching;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(28),
          child: Column(mainAxisSize: MainAxisSize.min, children: [
            const Icon(Icons.people_outline, size: 54, color: Colors.grey),
            const SizedBox(height: 12),
            Text(searching ? 'No matching clients' : 'No clients yet', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
            Text(searching ? 'Try a different search or clear the filters.' : 'Add a lead to start building your pipeline.', textAlign: TextAlign.center),
          ]),
        ),
      );
}

class _FilterSheet extends StatefulWidget {
  const _FilterSheet({required this.products, required this.productId, required this.priority});
  final List<Product> products;
  final int? productId;
  final Priority? priority;

  @override
  State<_FilterSheet> createState() => _FilterSheetState();
}

class _FilterSheetState extends State<_FilterSheet> {
  late int? _productId = widget.productId;
  late Priority? _priority = widget.priority;

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text('Filters', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          DropdownButtonFormField<int?>(
            key: const Key('filter-product'),
            initialValue: _productId,
            decoration: const InputDecoration(labelText: 'Product'),
            items: [
              const DropdownMenuItem<int?>(value: null, child: Text('Any product')),
              for (final p in widget.products) DropdownMenuItem<int?>(value: p.id, child: Text(p.name)),
            ],
            onChanged: (v) => setState(() => _productId = v),
          ),
          const SizedBox(height: 16),
          const Text('Priority'),
          const SizedBox(height: 6),
          Wrap(spacing: 8, children: [
            ChoiceChip(label: const Text('Any'), selected: _priority == null, onSelected: (_) => setState(() => _priority = null)),
            for (final p in Priority.values)
              ChoiceChip(label: Text(p.label), selected: _priority == p, onSelected: (_) => setState(() => _priority = p)),
          ]),
          const SizedBox(height: 20),
          Row(mainAxisAlignment: MainAxisAlignment.end, children: [
            TextButton(onPressed: () => Navigator.pop(context, (null, null)), child: const Text('Clear')),
            const SizedBox(width: 8),
            FilledButton(onPressed: () => Navigator.pop(context, (_productId, _priority)), child: const Text('Apply')),
          ]),
        ]),
      );
}
