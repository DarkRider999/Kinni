import 'package:flutter/material.dart';

import '../app_scope.dart';

/// "Ask Roshan" chat: when to leave, tolls, parking, weather.
class AssistantSheet extends StatefulWidget {
  const AssistantSheet({super.key});

  @override
  State<AssistantSheet> createState() => _AssistantSheetState();
}

class _AssistantSheetState extends State<AssistantSheet> {
  final _controller = TextEditingController();
  final _messages = <({bool user, String text})>[
    (user: false, text: 'Hi! Ask me "Am I late for work?", "How much Salik will I pay?" or "Is parking free now?"'),
  ];
  bool _sending = false;

  static const _suggestions = ['When should I leave for work?', 'How much Salik today?', 'Is parking free now?', "What's the weather?"];

  Future<void> _send([String? preset]) async {
    final text = (preset ?? _controller.text).trim();
    if (text.isEmpty || _sending) return;
    final scope = AppScope.of(context);
    final history = _messages.skip(1).map((m) => {'role': m.user ? 'user' : 'assistant', 'content': m.text}).toList();
    setState(() {
      _messages.add((user: true, text: text));
      _sending = true;
      _controller.clear();
    });
    try {
      final pos = scope.location.lastKnown;
      final reply = await scope.api.askAssistant(text, lat: pos?.latitude, lng: pos?.longitude, history: history);
      setState(() => _messages.add((user: false, text: reply)));
    } catch (e) {
      setState(() => _messages.add((user: false, text: 'Sorry, I could not answer that: $e')));
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          children: [
            ListTile(
              leading: const CircleAvatar(child: Icon(Icons.assistant)),
              title: const Text('Ask Roshan'),
              subtitle: const Text('Your UAE commute assistant'),
              trailing: IconButton(icon: const Icon(Icons.close), onPressed: () => Navigator.pop(context)),
            ),
            const Divider(height: 1),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(12),
                itemCount: _messages.length,
                itemBuilder: (context, i) {
                  final m = _messages[i];
                  return Align(
                    alignment: m.user ? Alignment.centerRight : Alignment.centerLeft,
                    child: Container(
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      padding: const EdgeInsets.all(12),
                      constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.8),
                      decoration: BoxDecoration(
                        color: m.user ? theme.colorScheme.primary : theme.colorScheme.surfaceContainerHighest,
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Text(m.text, style: TextStyle(color: m.user ? theme.colorScheme.onPrimary : theme.colorScheme.onSurface)),
                    ),
                  );
                },
              ),
            ),
            if (_sending) const LinearProgressIndicator(),
            SizedBox(
              height: 44,
              child: ListView(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 8),
                children: [
                  for (final s in _suggestions)
                    Padding(padding: const EdgeInsets.symmetric(horizontal: 4), child: ActionChip(label: Text(s), onPressed: () => _send(s))),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      onSubmitted: (_) => _send(),
                      textInputAction: TextInputAction.send,
                      decoration: InputDecoration(hintText: 'Ask anything about your drive', border: OutlineInputBorder(borderRadius: BorderRadius.circular(24))),
                    ),
                  ),
                  const SizedBox(width: 8),
                  IconButton.filled(onPressed: _sending ? null : _send, icon: const Icon(Icons.send)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
