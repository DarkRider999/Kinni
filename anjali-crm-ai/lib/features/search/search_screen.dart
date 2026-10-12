import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:speech_to_text/speech_to_text.dart';

import '../../core/services/permission_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../core/widgets/common.dart';
import '../../data/repositories/repositories.dart';
import '../../domain/entities/client.dart';
import '../../providers/app_providers.dart';
import '../clients/client_profile_screen.dart';
import '../whatsapp/whatsapp_button.dart';

/// Global search (FR-SRCH): name, phone, company, salary, location, product,
/// status, with voice input.
class SearchScreen extends ConsumerStatefulWidget {
  const SearchScreen({super.key});

  @override
  ConsumerState<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends ConsumerState<SearchScreen> {
  static final List<String> _recent = [];

  final _ctrl = TextEditingController();
  final _speech = SpeechToText();
  Timer? _debounce;
  String _query = '';
  bool _listening = false;

  @override
  void dispose() {
    _debounce?.cancel();
    _speech.stop();
    _ctrl.dispose();
    super.dispose();
  }

  void _onChanged(String v) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 200), () => setState(() => _query = v.trim()));
  }

  void _remember(String q) {
    if (q.isEmpty) return;
    _recent
      ..remove(q)
      ..insert(0, q);
    if (_recent.length > 8) _recent.removeLast();
  }

  Future<void> _voice() async {
    if (_listening) {
      await _speech.stop();
      setState(() => _listening = false);
      return;
    }
    if (!await Permissions.ensure(context, Permission.microphone, rationale: 'Voice search needs the microphone.')) return;
    final ok = await _speech.initialize(
      onStatus: (s) {
        if ((s == 'done' || s == 'notListening') && mounted) setState(() => _listening = false);
      },
      onError: (_) {
        if (mounted) setState(() => _listening = false);
      },
    );
    if (!ok) {
      if (mounted) showSnack(context, 'Speech recognition is not available on this device', error: true);
      return;
    }
    setState(() => _listening = true);
    await _speech.listen(
      listenOptions: SpeechListenOptions(partialResults: true, cancelOnError: true),
      onResult: (r) {
        _ctrl.text = r.recognizedWords;
        _ctrl.selection = TextSelection.collapsed(offset: _ctrl.text.length);
        setState(() => _query = r.recognizedWords.trim());
        if (r.finalResult) _remember(_query);
      },
    );
  }

  void _open(Client c) {
    _remember(_query);
    ClientProfileScreen.open(context, c.id);
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(clientsProvider); // rebuild results when data changes
    final names = ref.watch(productNamesProvider);
    final results = _query.isEmpty ? const <Client>[] : ref.read(clientRepoProvider).search(_query, productNames: names);
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 0,
        title: TextField(
          controller: _ctrl,
          autofocus: true,
          textInputAction: TextInputAction.search,
          onChanged: _onChanged,
          onSubmitted: (v) => _remember(v.trim()),
          decoration: InputDecoration(
            hintText: _listening ? 'Listening…' : 'Name, phone, company, salary…',
            border: InputBorder.none,
            enabledBorder: InputBorder.none,
            focusedBorder: InputBorder.none,
            filled: false,
          ),
        ),
        actions: [
          if (_query.isNotEmpty)
            IconButton(
              icon: const Icon(Icons.close_rounded),
              onPressed: () {
                _ctrl.clear();
                setState(() => _query = '');
              },
            ),
          IconButton(
            tooltip: 'Voice search',
            icon: Icon(_listening ? Icons.mic_rounded : Icons.mic_none_rounded, color: _listening ? AppColors.secondary : null),
            onPressed: _voice,
          ),
        ],
      ),
      body: _query.isEmpty
          ? ListView(
              padding: const EdgeInsets.all(16),
              children: [
                if (_recent.isNotEmpty) ...[
                  const SectionHeader('Recent searches', icon: Icons.history_rounded),
                  Wrap(spacing: 8, runSpacing: 8, children: [
                    for (final r in _recent)
                      ActionChip(
                        label: Text(r),
                        onPressed: () {
                          _ctrl.text = r;
                          setState(() => _query = r);
                        },
                      ),
                  ]),
                ] else
                  const EmptyState(
                    icon: Icons.manage_search_rounded,
                    title: 'Search your clients',
                    message: 'Try a name, phone number, company, location, product, status or salary (e.g. 15000).',
                  ),
              ],
            )
          : results.isEmpty
              ? EmptyState(icon: Icons.search_off_rounded, title: 'No results for "$_query"')
              : ListView.separated(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: results.length,
                  separatorBuilder: (_, _) => const Divider(indent: 72),
                  itemBuilder: (_, i) {
                    final c = results[i];
                    final sub = [names[c.productId], c.company, c.location, if (c.monthlySalary != null) Fmt.aed(c.monthlySalary)]
                        .whereType<String>()
                        .join(' · ');
                    return ListTile(
                      leading: PersonAvatar(photoPath: c.photoPath, initials: c.initials),
                      title: _Highlight(text: c.name, query: _query),
                      subtitle: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                        Row(children: [
                          WhatsAppIcon(phone: c.whatsappNumber, client: c, size: 18),
                          Flexible(child: _Highlight(text: c.phone, query: _query)),
                        ]),
                        if (sub.isNotEmpty) Text(sub, maxLines: 1, overflow: TextOverflow.ellipsis),
                      ]),
                      trailing: StatusChip(c.status, dense: true),
                      onTap: () => _open(c),
                    );
                  },
                ),
    );
  }
}

/// Bolds the first case-insensitive occurrence of [query] in [text].
class _Highlight extends StatelessWidget {
  const _Highlight({required this.text, required this.query});
  final String text;
  final String query;

  @override
  Widget build(BuildContext context) {
    final i = text.toLowerCase().indexOf(query.toLowerCase());
    final base = DefaultTextStyle.of(context).style;
    if (query.isEmpty || i < 0) return Text(text, maxLines: 1, overflow: TextOverflow.ellipsis);
    return Text.rich(
      TextSpan(children: [
        TextSpan(text: text.substring(0, i)),
        TextSpan(
          text: text.substring(i, i + query.length),
          style: base.copyWith(fontWeight: FontWeight.w800, color: AppColors.primary),
        ),
        TextSpan(text: text.substring(i + query.length)),
      ]),
      maxLines: 1,
      overflow: TextOverflow.ellipsis,
    );
  }
}
