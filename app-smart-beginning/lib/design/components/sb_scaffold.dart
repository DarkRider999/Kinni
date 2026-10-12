import 'package:flutter/material.dart';

/// App scaffold with safe-area and an optional parent-lock affordance
/// (SPEC §6.2). Centralises the child-facing chrome so screens don't
/// re-implement it.
class SbScaffold extends StatelessWidget {
  const SbScaffold({
    super.key,
    required this.body,
    this.title,
    this.showParentLock = false,
    this.onParentLock,
    this.bottomNavigationBar,
  });

  final Widget body;
  final String? title;
  final bool showParentLock;
  final VoidCallback? onParentLock;
  final Widget? bottomNavigationBar;

  @override
  Widget build(BuildContext context) {
    final String? titleText = title;
    return Scaffold(
      appBar: titleText == null
          ? null
          : AppBar(
              title: Text(titleText),
              actions: <Widget>[
                if (showParentLock)
                  IconButton(
                    tooltip: 'Parent area',
                    icon: const Icon(Icons.lock_outline),
                    onPressed: onParentLock,
                  ),
              ],
            ),
      body: SafeArea(child: body),
      bottomNavigationBar: bottomNavigationBar,
    );
  }
}
