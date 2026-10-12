import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/utils/phone_utils.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';
import '../../providers/app_providers.dart';
import '../calls/call_actions.dart';
import '../whatsapp/whatsapp_button.dart';
import 'client_form_screen.dart';
import 'status_sheet.dart';
import 'client_profile_screen.dart';

/// Sort orders offered by the list.
enum ClientSort {
  updated('Recently updated'),
  name('Name A–Z'),
  score('Lead score'),
  followup('Next followup');

  const ClientSort(this.label);
  final String label;
}

/// Searchable, filterable client list.
class ClientListScreen extends ConsumerStatefulWidget {
  const ClientListScreen({super.key, this.initialStatus, this.title, this.filter, this.embedded = false});

  /// Pre-selected status filter chip.
  final LeadStatus? initialStatus;

  /// Optional app-bar title (drill-down from dashboard KPIs).
  final String? title;

  /// Optional extra predicate (e.g. "followups today").
  final bool Function(Client)? filter;

  /// True when shown as the Clients tab (no back button).
  final bool embedded;

  @override
  ConsumerState<ClientListScreen> createState() => _ClientListScreenState();
}

/// One-tap quick filters above the list.
enum QuickFilter {
  creditCard('Credit Card'),
  loan('Loan'),
  approved('Approved'),
  rejected('Rejected'),
  awaitingDocs('Awaiting Documents'),
  notInterested('Not Interested'),
  followUp('Follow Up'),
  today('Today'),
  thisWeek('This Week'),
  thisMonth('This Month');

  const QuickFilter(this.label);
  final String label;
}

class _ClientListScreenState extends ConsumerState<ClientListScreen> {
  QuickFilter? _quick;
  RangeValues? _salary;
  String? _company;
  String? _location;
  static const _salaryMax = 100000.0;

  final _search = TextEditingController();
  late LeadStatus? _status = widget.initialStatus;
  String? _productId;
  Priority? _priority;
  ClientSort _sort = ClientSort.updated;

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  bool _quickMatch(Client c, Map<String, String> productNames, Set<String> awaiting, DateTime now) {
    final product = (productNames[c.productId] ?? '').toLowerCase();
    final next = c.nextFollowupAt;
    final today = DateTime(now.year, now.month, now.day);
    return switch (_quick) {
      null => true,
      QuickFilter.creditCard => product.contains('card'),
      QuickFilter.loan => product.contains('loan') || product.contains('mortgage'),
      QuickFilter.approved => c.status == LeadStatus.approved || c.status == LeadStatus.disbursed,
      QuickFilter.rejected => c.status == LeadStatus.rejected,
      QuickFilter.awaitingDocs => c.status.isDocumentStage || awaiting.contains(c.id),
      QuickFilter.notInterested => c.status == LeadStatus.notInterested,
      QuickFilter.followUp => next != null,
      QuickFilter.today => next != null && next.isBefore(today.add(const Duration(days: 1))),
      QuickFilter.thisWeek => next != null && next.isBefore(today.add(const Duration(days: 7))),
      QuickFilter.thisMonth => next != null && next.isBefore(DateTime(now.year, now.month + 1)),
    };
  }

  List<Client> _apply(List<Client> all, Map<String, int> scores) {
    final productNames = ref.read(productNamesProvider);
    final awaiting = ref.read(clientsWithPendingDocsProvider);
    final now = ref.read(nowProvider);
    final q = _search.text.trim().toLowerCase();
    final qDigits = PhoneUtils.digits(q);
    final list = all.where((c) {
      if (_status != null && c.status != _status) return false;
      if (_productId != null && c.productId != _productId) return false;
      if (_priority != null && c.priority != _priority) return false;
      if (widget.filter != null && !widget.filter!(c)) return false;
      if (!_quickMatch(c, productNames, awaiting, now)) return false;
      if (_company != null && (c.company ?? '').trim() != _company) return false;
      if (_location != null && (c.location ?? '').trim() != _location) return false;
      if (_salary != null) {
        final s = c.monthlySalary;
        if (s == null || s < _salary!.start || (_salary!.end < _salaryMax && s > _salary!.end)) return false;
      }
      if (q.isEmpty) return true;
      return c.name.toLowerCase().contains(q) ||
          (c.company ?? '').toLowerCase().contains(q) ||
          (c.email ?? '').toLowerCase().contains(q) ||
          (c.location ?? '').toLowerCase().contains(q) ||
          (productNames[c.productId] ?? '').toLowerCase().contains(q) ||
          c.status.label.toLowerCase().contains(q) ||
          (qDigits.length >= 3 && (PhoneUtils.digits(c.phone).contains(qDigits) || PhoneUtils.digits(c.whatsapp ?? '').contains(qDigits)));
    }).toList();
    final far = DateTime(9999);
    list.sort(switch (_sort) {
      ClientSort.updated => (a, b) => b.updatedAt.compareTo(a.updatedAt),
      ClientSort.name => (a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()),
      ClientSort.score => (a, b) => (scores[b.id] ?? 0).compareTo(scores[a.id] ?? 0),
      ClientSort.followup => (a, b) => (a.nextFollowupAt ?? far).compareTo(b.nextFollowupAt ?? far),
    });
    return list;
  }

  Future<void> _openFilters() async {
    final products = (ref.read(productsProvider).value ?? const []).where((p) => p.active || p.id == _productId).toList();
    String? product = _productId;
    Priority? priority = _priority;
    var salary = _salary ?? const RangeValues(0, _salaryMax);
    String? company = _company;
    String? location = _location;
    final all = ref.read(clientsProvider).value ?? const <Client>[];
    final companies = {for (final c in all) if ((c.company ?? '').trim().isNotEmpty) c.company!.trim()}.toList()..sort();
    final locations = {for (final c in all) if ((c.location ?? '').trim().isNotEmpty) c.location!.trim()}.toList()..sort();
    final applied = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (c) => StatefulBuilder(
        builder: (c, set) => SafeArea(
          child: SingleChildScrollView(
            child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Filters', style: Theme.of(c).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 16),
                DropdownButtonFormField<String?>(
                  initialValue: product,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Product'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All products')),
                    for (final p in products) DropdownMenuItem(value: p.id, child: Text(p.name, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (v) => set(() => product = v),
                ),
                const SizedBox(height: 16),
                Text('Priority', style: Theme.of(c).textTheme.labelLarge),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    ChoiceChip(label: const Text('Any'), selected: priority == null, onSelected: (_) => set(() => priority = null)),
                    for (final p in Priority.values)
                      ChoiceChip(
                        label: Text(p.label),
                        selected: priority == p,
                        selectedColor: AppColors.priority(p).withValues(alpha: .2),
                        onSelected: (_) => set(() => priority = p),
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                Text('Monthly salary: AED ${salary.start.round()} – ${salary.end >= _salaryMax ? '100k+' : salary.end.round()}',
                    style: Theme.of(c).textTheme.labelLarge),
                RangeSlider(
                  values: salary,
                  min: 0,
                  max: _salaryMax,
                  divisions: 20,
                  onChanged: (v) => set(() => salary = v),
                ),
                DropdownButtonFormField<String?>(
                  initialValue: company,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Company'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All companies')),
                    for (final x in companies) DropdownMenuItem(value: x, child: Text(x, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (v) => set(() => company = v),
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String?>(
                  initialValue: location,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Location'),
                  items: [
                    const DropdownMenuItem(value: null, child: Text('All locations')),
                    for (final x in locations) DropdownMenuItem(value: x, child: Text(x, overflow: TextOverflow.ellipsis)),
                  ],
                  onChanged: (v) => set(() => location = v),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () {
                          product = null;
                          priority = null;
                          salary = const RangeValues(0, _salaryMax);
                          company = null;
                          location = null;
                          Navigator.pop(c, true);
                        },
                        child: const Text('Clear'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(child: FilledButton(onPressed: () => Navigator.pop(c, true), child: const Text('Apply'))),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
      ),
    );
    if (applied == true) {
      setState(() {
        _productId = product;
        _priority = priority;
        _salary = (salary.start <= 0 && salary.end >= _salaryMax) ? null : salary;
        _company = company;
        _location = location;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(clientsProvider);
    final scores = ref.watch(scoresProvider);
    final products = ref.watch(productNamesProvider);
    final now = ref.watch(nowProvider);
    final clients = _apply(async.value ?? const [], scores);
    final filtersActive = _productId != null || _priority != null || _salary != null || _company != null || _location != null;

    final body = Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(12, 4, 12, 4),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _search,
                  onChanged: (_) => setState(() {}),
                  textInputAction: TextInputAction.search,
                  decoration: InputDecoration(
                    hintText: 'Search name, phone, company…',
                    prefixIcon: const Icon(Icons.search_rounded),
                    isDense: true,
                    suffixIcon: _search.text.isEmpty
                        ? null
                        : IconButton(
                            tooltip: 'Clear',
                            onPressed: () => setState(_search.clear),
                            icon: const Icon(Icons.close_rounded),
                          ),
                  ),
                ),
              ),
              IconButton(
                tooltip: 'Filters',
                onPressed: _openFilters,
                icon: Badge(isLabelVisible: filtersActive, child: const Icon(Icons.tune_rounded)),
              ),
              PopupMenuButton<ClientSort>(
                tooltip: 'Sort',
                icon: const Icon(Icons.sort_rounded),
                initialValue: _sort,
                onSelected: (s) => setState(() => _sort = s),
                itemBuilder: (_) => [for (final s in ClientSort.values) CheckedPopupMenuItem(value: s, checked: s == _sort, child: Text(s.label))],
              ),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            children: [
              for (final f in QuickFilter.values)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: FilterChip(
                    label: Text(f.label),
                    selected: _quick == f,
                    onSelected: (_) => setState(() => _quick = _quick == f ? null : f),
                  ),
                ),
            ],
          ),
        ),
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            children: [
              Padding(
                padding: const EdgeInsets.only(right: 6),
                child: ChoiceChip(label: const Text('All'), selected: _status == null, onSelected: (_) => setState(() => _status = null)),
              ),
              for (final s in LeadStatus.values)
                Padding(
                  padding: const EdgeInsets.only(right: 6),
                  child: ChoiceChip(
                    label: Text(s.label),
                    selected: _status == s,
                    selectedColor: AppColors.status(s).withValues(alpha: .22),
                    onSelected: (_) => setState(() => _status = _status == s ? null : s),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: async.isLoading && !async.hasValue
              ? const Center(child: CircularProgressIndicator())
              : clients.isEmpty
                  ? EmptyState(
                      icon: Icons.people_outline_rounded,
                      title: (async.value ?? const []).isEmpty ? 'No clients yet' : 'No matching clients',
                      message: (async.value ?? const []).isEmpty ? 'Add your first lead to get started.' : 'Try another search or filter.',
                      action: 'Add lead',
                      onAction: _addLead,
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 96),
                      itemCount: clients.length,
                      itemBuilder: (_, i) {
                        final c = clients[i];
                        // Swipe right = WhatsApp, swipe left = edit, long press = change status.
                        return Dismissible(
                          key: ValueKey('client-${c.id}'),
                          background: _swipeBg(Alignment.centerLeft, whatsappGreen, Icons.chat_rounded, 'WhatsApp'),
                          secondaryBackground: _swipeBg(Alignment.centerRight, AppColors.primary, Icons.edit_rounded, 'Edit'),
                          confirmDismiss: (dir) async {
                            if (dir == DismissDirection.startToEnd) {
                              await openWhatsApp(context, ref, c.whatsappNumber, client: c);
                            } else {
                              await Navigator.of(context).push(MaterialPageRoute(builder: (_) => ClientFormScreen(existing: c)));
                            }
                            return false;
                          },
                          child: GestureDetector(
                            onLongPress: () => showStatusChangeSheet(context, ref, c),
                            child: ClientCard(
                              client: c,
                              productName: products[c.productId],
                              score: scores[c.id] ?? 0,
                              now: now,
                            ),
                          ),
                        );
                      },
                    ),
        ),
      ],
    );

    final scaffold = Scaffold(
      backgroundColor: widget.embedded ? Colors.transparent : null,
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        backgroundColor: widget.embedded ? Colors.transparent : null,
        title: Text(widget.title ?? 'Clients'),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: Center(child: Text('${clients.length}', style: Theme.of(context).textTheme.titleMedium)),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        heroTag: widget.embedded ? 'clients-fab' : null,
        onPressed: _addLead,
        icon: const Icon(Icons.person_add_alt_1_rounded),
        label: const Text('Add lead'),
      ),
      body: body,
    );
    return widget.embedded ? TabBackground(image: AppAssets.tabBackgrounds[1], child: scaffold) : scaffold;
  }

  Widget _swipeBg(Alignment align, Color color, IconData icon, String label) => Container(
        alignment: align,
        margin: const EdgeInsets.symmetric(vertical: 5),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        decoration: BoxDecoration(color: color, borderRadius: BorderRadius.circular(20)),
        child: Row(mainAxisSize: MainAxisSize.min, children: [
          Icon(icon, color: Colors.white),
          const SizedBox(width: 8),
          Text(label, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
        ]),
      );

  void _addLead() => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const ClientFormScreen()));
}

/// One client in the list: avatar, key facts, call and WhatsApp actions.
class ClientCard extends ConsumerWidget {
  const ClientCard({super.key, required this.client, required this.score, required this.now, this.productName});
  final Client client;
  final String? productName;
  final int score;
  final DateTime now;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = client;
    final t = Theme.of(context).textTheme;
    final muted = t.bodySmall?.color;
    final next = c.nextFollowupAt;
    final overdue = next != null && next.isBefore(now);
    final facts = [productName, if (c.monthlySalary != null) '${Fmt.aedCompact(c.monthlySalary)}/mo'].whereType<String>().join(' · ');
    return GlassCard(
      margin: const EdgeInsets.symmetric(vertical: 5),
      padding: const EdgeInsets.fromLTRB(12, 12, 4, 8),
      onTap: () => ClientProfileScreen.open(context, c.id),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          PersonAvatar(photoPath: c.photoPath, initials: c.initials, heroTag: 'avatar-${c.id}'),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(c.name, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w800), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                    if (c.rating > 0) RatingStars(value: c.rating, size: 13),
                  ],
                ),
                if (facts.isNotEmpty)
                  Text(facts, style: t.bodySmall, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 4,
                  crossAxisAlignment: WrapCrossAlignment.center,
                  children: [
                    StatusChip(c.status, dense: true),
                    if (c.priority == Priority.high || c.priority == Priority.urgent)
                      Pill(label: c.priority.label, color: AppColors.priority(c.priority), dense: true),
                    if (next != null)
                      Pill(
                        label: '${Fmt.dateShort(next)} ${Fmt.time(next)}',
                        color: overdue ? AppColors.danger : AppColors.info,
                        icon: overdue ? Icons.warning_amber_rounded : Icons.event_rounded,
                        dense: true,
                      ),
                  ],
                ),
                Row(
                  children: [
                    WhatsAppIcon(phone: c.phone, client: c, size: 18),
                    Flexible(
                      child: Text(c.phone, style: t.bodySmall?.copyWith(color: muted), maxLines: 1, overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Column(
            children: [
              ScoreBadge(score, size: 32),
              IconButton(
                tooltip: 'Call ${c.name}',
                onPressed: () => startCall(context, ref, c),
                icon: const Icon(Icons.call_rounded, color: AppColors.success),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
