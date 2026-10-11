import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/constants/app_assets.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/date_utils.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../core/widgets/glass_card.dart';
import '../../core/widgets/stat_card.dart';
import '../../core/widgets/tab_background.dart';
import '../../domain/entities/activity.dart';
import '../../domain/entities/client.dart';
import '../../domain/entities/enums.dart';
import '../../domain/entities/followup.dart';
import '../../domain/services/insights_engine.dart';
import '../../domain/services/report_engine.dart';
import '../../providers/app_providers.dart';
import '../../providers/crm_actions.dart';
import '../calls/call_actions.dart';
import '../clients/client_list_screen.dart';
import '../clients/client_profile_screen.dart';
import '../reports/charts.dart';
import '../search/search_screen.dart';
import '../shell/main_shell.dart';
import '../whatsapp/whatsapp_button.dart';

/// Home dashboard (FR HOME-01…08).
class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final clientsLoaded = ref.watch(clientsProvider).hasValue;
    return Scaffold(
      backgroundColor: Colors.transparent,
      body: TabBackground(
        image: AppAssets.tabBackgrounds[0],
        child: SafeArea(
          bottom: false,
          child: !clientsLoaded
              ? const Center(child: CircularProgressIndicator())
              : RefreshIndicator(
                  onRefresh: () => ref.read(syncServiceProvider).syncNow(),
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 110),
                    children: const [
                      _Header(),
                      SizedBox(height: 14),
                      _SearchBar(),
                      SizedBox(height: 14),
                      _ProductivityCard(),
                      _KpiGrid(),
                      _AiRecommendations(),
                      _TodayTasks(),
                      _ChartsSection(),
                      _RecentActivity(),
                    ],
                  ),
                ),
        ),
      ),
    );
  }
}

void _openList(BuildContext context, String title, {LeadStatus? status, bool Function(Client)? filter}) => Navigator.of(context).push(
      MaterialPageRoute(builder: (_) => ClientListScreen(title: title, initialStatus: status, filter: filter)),
    );

class _Header extends ConsumerWidget {
  const _Header();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileProvider);
    final now = ref.watch(nowProvider);
    final t = Theme.of(context).textTheme;
    final photo = profile.photoPath == null ? null : File(profile.photoPath!);
    return Row(
      children: [
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('${DateX.greeting(now)}, ${profile.firstName}', style: t.headlineSmall?.copyWith(fontWeight: FontWeight.w800)),
              const SizedBox(height: 2),
              Text(Fmt.weekday(now), style: t.bodyMedium?.copyWith(color: t.bodySmall?.color)),
            ],
          ),
        ),
        GestureDetector(
          onTap: () => MainShell.goToTab(context, 5),
          child: Container(
            padding: const EdgeInsets.all(2.5),
            decoration: const BoxDecoration(shape: BoxShape.circle, gradient: AppColors.brandGradient),
            child: CircleAvatar(
              radius: 26,
              backgroundImage: (photo != null && photo.existsSync()) ? FileImage(photo) : const AssetImage(AppAssets.logo) as ImageProvider,
            ),
          ),
        ),
      ],
    );
  }
}

class _SearchBar extends StatelessWidget {
  const _SearchBar();

  @override
  Widget build(BuildContext context) => GlassCard(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        radius: 16,
        onTap: () => Navigator.of(context).push(MaterialPageRoute(builder: (_) => const SearchScreen())),
        child: Row(
          children: [
            const Icon(Icons.search_rounded, color: AppColors.primary),
            const SizedBox(width: 10),
            Expanded(child: Text('Search name, phone, company…', style: TextStyle(color: Theme.of(context).hintColor))),
            const Icon(Icons.mic_none_rounded, color: AppColors.secondary),
          ],
        ),
      );
}

class _ProductivityCard extends ConsumerWidget {
  const _ProductivityCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(productivityProvider);
    final t = Theme.of(context).textTheme;
    Widget metric(IconData i, String v, String l, Color c) => Expanded(
          child: Column(
            children: [
              Icon(i, color: c, size: 22),
              const SizedBox(height: 4),
              Text(v, style: t.titleMedium?.copyWith(fontWeight: FontWeight.w800)),
              Text(l, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.labelSmall),
            ],
          ),
        );
    Widget score(String label, int v) => Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Text(label, style: t.labelMedium),
                const Spacer(),
                Text('$v', style: t.labelLarge?.copyWith(fontWeight: FontWeight.w800, color: AppColors.score(v))),
              ]),
              const SizedBox(height: 4),
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(value: v / 100, minHeight: 7, color: AppColors.score(v), backgroundColor: AppColors.score(v).withValues(alpha: .15)),
              ),
            ],
          ),
        );
    return GlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.bolt_rounded, color: AppColors.gold),
            const SizedBox(width: 6),
            Text('Today\'s productivity', style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 12),
          Row(children: [
            metric(Icons.task_alt_rounded, '${p.followupsDoneToday}', 'Followups', AppColors.success),
            metric(Icons.call_made_rounded, '${p.callsToday}', 'Calls', AppColors.primary),
            metric(Icons.emoji_events_rounded, '${p.conversionsToday}', 'Converted', AppColors.gold),
            metric(Icons.pending_actions_rounded, '${p.pendingTasks}', 'Pending', AppColors.warning),
          ]),
          const SizedBox(height: 14),
          Row(children: [score('Weekly score', p.weeklyScore), const SizedBox(width: 16), score('Monthly score', p.monthlyScore)]),
        ],
      ),
    );
  }
}

class _KpiGrid extends ConsumerWidget {
  const _KpiGrid();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final k = ref.watch(kpiProvider);
    final pendingDocs = ref.watch(clientsWithPendingDocsProvider);
    final now = ref.watch(nowProvider);
    final cards = <(String, String, IconData, Color, VoidCallback)>[
      ('Total leads', '${k.total}', Icons.groups_rounded, AppColors.primary, () => _openList(context, 'All leads')),
      ('New leads', '${k.count(LeadStatus.newLead)}', Icons.fiber_new_rounded, AppColors.info,
          () => _openList(context, 'New leads', status: LeadStatus.newLead)),
      ('Interested', '${k.count(LeadStatus.interested)}', Icons.favorite_rounded, AppColors.secondary,
          () => _openList(context, 'Interested', status: LeadStatus.interested)),
      ('Documents pending', '${k.documentsPending}', Icons.folder_open_rounded, AppColors.warning,
          () => _openList(context, 'Documents pending', filter: (c) => c.status.isDocumentStage || (c.status.isOpen && pendingDocs.contains(c.id)))),
      ('Submitted', '${k.count(LeadStatus.applicationSubmitted)}', Icons.send_rounded, AppColors.status(LeadStatus.applicationSubmitted),
          () => _openList(context, 'Application submitted', status: LeadStatus.applicationSubmitted)),
      ('Approved', '${k.count(LeadStatus.approved)}', Icons.verified_rounded, AppColors.success,
          () => _openList(context, 'Approved', status: LeadStatus.approved)),
      ('Rejected', '${k.count(LeadStatus.rejected)}', Icons.cancel_rounded, AppColors.danger,
          () => _openList(context, 'Rejected', status: LeadStatus.rejected)),
      ('Not interested', '${k.count(LeadStatus.notInterested)}', Icons.do_not_disturb_on_rounded, AppColors.status(LeadStatus.notInterested),
          () => _openList(context, 'Not interested', status: LeadStatus.notInterested)),
      ('Not eligible', '${k.count(LeadStatus.notEligible)}', Icons.block_rounded, AppColors.status(LeadStatus.notEligible),
          () => _openList(context, 'Not eligible', status: LeadStatus.notEligible)),
      ('Followups today', '${k.followupsToday}', Icons.today_rounded, AppColors.primary, () => MainShell.goToTab(context, 3)),
      ('Overdue', '${k.overdueFollowups}', Icons.alarm_rounded, AppColors.danger, () => MainShell.goToTab(context, 3)),
      ('Conversions (month)', '${k.monthlyConversions}', Icons.emoji_events_rounded, AppColors.gold,
          () => _openList(context, 'Converted this month', filter: (c) => c.status.isConverted && DateX.sameMonth(c.statusChangedAt, now))),
      ('Loan disbursed', Fmt.aedCompact(k.disbursedAmount), Icons.payments_rounded, AppColors.status(LeadStatus.disbursed),
          () => _openList(context, 'Disbursed', status: LeadStatus.disbursed)),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader('Pipeline at a glance', icon: Icons.space_dashboard_rounded),
        LayoutBuilder(builder: (context, c) {
          final cols = c.maxWidth >= 900 ? 4 : c.maxWidth >= 560 ? 3 : 2;
          const gap = 10.0;
          final w = (c.maxWidth - gap * (cols - 1)) / cols;
          return Wrap(
            spacing: gap,
            runSpacing: gap,
            children: [
              for (final (label, value, icon, color, onTap) in cards)
                SizedBox(width: w, child: StatCard(label: label, value: value, icon: icon, color: color, onTap: onTap)),
            ],
          );
        }),
      ],
    );
  }
}

class _AiRecommendations extends ConsumerWidget {
  const _AiRecommendations();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final i = ref.watch(insightsProvider);
    final productNames = ref.watch(productNamesProvider);
    final t = Theme.of(context).textTheme;
    final groups = <(String, IconData, Color, List<ScoredClient>)>[
      ('Urgent followups', Icons.local_fire_department_rounded, AppColors.danger, i.overdue),
      ('Pending document collection', Icons.description_rounded, AppColors.warning, i.pendingDocuments),
      ('Likely to convert', Icons.trending_up_rounded, AppColors.success, i.likelyToConvert),
      ('High priority', Icons.priority_high_rounded, AppColors.secondary, i.highPriority),
      ('Waiting the longest', Icons.hourglass_bottom_rounded, AppColors.info, i.longestWaiting),
      ('Upcoming opportunities', Icons.event_available_rounded, AppColors.primary, i.upcoming),
    ].where((g) => g.$4.isNotEmpty).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader('AI recommendations', icon: Icons.auto_awesome_rounded),
        if (i.bestProduct != null || i.bestSource != null)
          Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: Wrap(spacing: 8, runSpacing: 8, children: [
              if (i.bestProduct != null)
                Pill(
                  icon: Icons.star_rounded,
                  color: AppColors.gold,
                  label: 'Best product: ${i.bestProduct!.label} (${Fmt.percent(i.bestProduct!.conversionRate)})',
                ),
              if (i.bestSource != null)
                Pill(
                  icon: Icons.campaign_rounded,
                  color: AppColors.primary,
                  label: 'Best source: ${i.bestSource!.label} (${Fmt.percent(i.bestSource!.conversionRate)})',
                ),
            ]),
          ),
        if (groups.isEmpty)
          const GlassCard(child: Text('Add a few leads and followups, and personalised recommendations will appear here.'))
        else
          for (final (title, icon, color, items) in groups)
            GlassCard(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.fromLTRB(14, 12, 6, 6),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(children: [
                    Icon(icon, color: color, size: 20),
                    const SizedBox(width: 8),
                    Expanded(child: Text(title, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700))),
                  ]),
                  for (final s in items.take(3))
                    ListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      leading: PersonAvatar(photoPath: s.client.photoPath, initials: s.client.initials, size: 36),
                      title: Text(s.client.name, maxLines: 1, overflow: TextOverflow.ellipsis),
                      subtitle: Text(
                        [s.reason, productNames[s.client.productId]].whereType<String>().join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      trailing: Row(mainAxisSize: MainAxisSize.min, children: [
                        WhatsAppIcon(phone: s.client.whatsappNumber, client: s.client),
                        IconButton(
                          visualDensity: VisualDensity.compact,
                          icon: const Icon(Icons.call_rounded, color: AppColors.primary, size: 20),
                          onPressed: () => startCall(context, ref, s.client),
                        ),
                      ]),
                      onTap: () => ClientProfileScreen.open(context, s.client.id),
                    ),
                ],
              ),
            ),
      ],
    );
  }
}

class _TodayTasks extends ConsumerWidget {
  const _TodayTasks();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(nowProvider);
    final clients = {for (final c in ref.watch(clientsProvider).value ?? const <Client>[]) c.id: c};
    final end = DateX.endOfDay(now);
    final tasks = (ref.watch(followupsProvider).value ?? const <Followup>[])
        .where((f) => f.isPending && f.dueAt.isBefore(end) && clients.containsKey(f.clientId))
        .toList()
      ..sort((a, b) => a.dueAt.compareTo(b.dueAt));
    final t = Theme.of(context).textTheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader("Today's tasks", icon: Icons.checklist_rounded, action: 'All followups', onAction: () => MainShell.goToTab(context, 3)),
        if (tasks.isEmpty)
          const GlassCard(child: Row(children: [
            Icon(Icons.celebration_rounded, color: AppColors.success),
            SizedBox(width: 10),
            Expanded(child: Text('Nothing due today. A great day to find new leads!')),
          ]))
        else
          for (final f in tasks.take(8))
            Builder(builder: (context) {
              final c = clients[f.clientId]!;
              final overdue = f.dueAt.isBefore(now);
              return GlassCard(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.fromLTRB(12, 10, 4, 10),
                onTap: () => ClientProfileScreen.open(context, c.id),
                child: Row(
                  children: [
                    Container(
                      width: 4,
                      height: 44,
                      decoration: BoxDecoration(color: overdue ? AppColors.danger : AppColors.primary, borderRadius: BorderRadius.circular(4)),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(c.name, maxLines: 1, overflow: TextOverflow.ellipsis, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                          Text(
                            '${overdue ? 'Overdue · ${Fmt.relative(f.dueAt, now)}' : Fmt.time(f.dueAt)}${f.note == null ? '' : ' · ${f.note}'}',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: t.bodySmall?.copyWith(color: overdue ? AppColors.danger : null),
                          ),
                        ],
                      ),
                    ),
                    WhatsAppIcon(phone: c.whatsappNumber, client: c),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      icon: const Icon(Icons.call_rounded, color: AppColors.primary, size: 20),
                      onPressed: () => startCall(context, ref, c),
                    ),
                    IconButton(
                      visualDensity: VisualDensity.compact,
                      tooltip: 'Mark complete',
                      icon: const Icon(Icons.check_circle_outline_rounded, color: AppColors.success, size: 22),
                      onPressed: () async {
                        await ref.read(crmActionsProvider).completeFollowup(f);
                        if (context.mounted) showSnack(context, 'Followup with ${c.name} completed');
                      },
                    ),
                  ],
                ),
              );
            }),
      ],
    );
  }
}

class _ChartsSection extends ConsumerStatefulWidget {
  const _ChartsSection();

  @override
  ConsumerState<_ChartsSection> createState() => _ChartsSectionState();
}

class _ChartsSectionState extends ConsumerState<_ChartsSection> {
  final _page = PageController(viewportFraction: .94);
  int _current = 0;

  @override
  void dispose() {
    _page.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final clients = ref.watch(clientsProvider).value ?? const <Client>[];
    final products = ref.watch(productsProvider).value ?? const [];
    final now = ref.watch(nowProvider);
    final k = ref.watch(kpiProvider);
    final t = Theme.of(context).textTheme;
    final charts = <(String, Widget)>[
      ('Lead funnel', LeadFunnelChart(ReportEngine.funnel(clients))),
      ('Monthly performance', MonthlyPerformanceChart(ReportEngine.monthly(clients, now))),
      ('Product performance', ProductPerformanceChart(ReportEngine.groupBy(ReportGroup.product, clients, products))),
      ('Approval conversion rate', ApprovalRateGauge(k.approvalRate)),
      ('Status distribution', StatusDistributionChart(k.byStatus)),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader('Performance', icon: Icons.bar_chart_rounded),
        SizedBox(
          height: 300,
          child: PageView.builder(
            controller: _page,
            itemCount: charts.length,
            onPageChanged: (i) => setState(() => _current = i),
            itemBuilder: (_, i) => Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: GlassCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(charts[i].$1, style: t.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                    const SizedBox(height: 10),
                    Expanded(child: clients.isEmpty ? const Center(child: Text('No data yet')) : charts[i].$2),
                  ],
                ),
              ),
            ),
          ),
        ),
        const SizedBox(height: 8),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < charts.length; i++)
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                margin: const EdgeInsets.symmetric(horizontal: 3),
                width: i == _current ? 18 : 7,
                height: 7,
                decoration: BoxDecoration(
                  color: i == _current ? AppColors.primary : AppColors.primary.withValues(alpha: .25),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _RecentActivity extends ConsumerWidget {
  const _RecentActivity();

  static IconData icon(ActivityType t) => switch (t) {
        ActivityType.created => Icons.person_add_alt_1_rounded,
        ActivityType.updated => Icons.edit_rounded,
        ActivityType.statusChanged => Icons.swap_horiz_rounded,
        ActivityType.call => Icons.call_rounded,
        ActivityType.whatsapp => Icons.chat_rounded,
        ActivityType.followupScheduled => Icons.event_rounded,
        ActivityType.followupCompleted => Icons.task_alt_rounded,
        ActivityType.document => Icons.description_rounded,
        ActivityType.voiceNote => Icons.mic_rounded,
        ActivityType.merged => Icons.merge_rounded,
        ActivityType.report => Icons.picture_as_pdf_rounded,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final now = ref.watch(nowProvider);
    final clients = {for (final c in ref.watch(clientsProvider).value ?? const <Client>[]) c.id: c};
    final acts = (ref.watch(activitiesProvider).value ?? const <Activity>[])
        .where((a) => a.clientId == null || clients.containsKey(a.clientId))
        .take(15)
        .toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionHeader('Recent activity', icon: Icons.history_rounded),
        GlassCard(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          child: acts.isEmpty
              ? const Padding(padding: EdgeInsets.all(8), child: Text('Your activity will appear here.'))
              : Column(
                  children: [
                    for (final a in acts)
                      ListTile(
                        dense: true,
                        leading: CircleAvatar(
                          radius: 16,
                          backgroundColor: (a.toStatus == null ? AppColors.primary : AppColors.status(a.toStatus!)).withValues(alpha: .14),
                          child: Icon(icon(a.type), size: 17, color: a.toStatus == null ? AppColors.primary : AppColors.status(a.toStatus!)),
                        ),
                        title: Text(
                          a.clientId == null ? a.title : '${clients[a.clientId]!.name} · ${a.title}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        subtitle: a.detail == null ? null : Text(a.detail!, maxLines: 1, overflow: TextOverflow.ellipsis),
                        trailing: Text(Fmt.relative(a.at, now), style: Theme.of(context).textTheme.labelSmall),
                        onTap: a.clientId == null ? null : () => ClientProfileScreen.open(context, a.clientId!),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
