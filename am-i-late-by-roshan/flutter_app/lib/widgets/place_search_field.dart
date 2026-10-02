import 'dart:async';

import 'package:flutter/material.dart';

import '../app_scope.dart';
import '../models/place.dart';

/// A tappable field that opens a place search sheet (OSM search via the backend).
class PlaceSearchField extends StatelessWidget {
  final String hint;
  final IconData icon;
  final Place? value;
  final ValueChanged<Place> onSelected;
  final Future<Place?> Function()? onUseCurrentLocation;

  const PlaceSearchField({super.key, required this.hint, required this.icon, required this.value, required this.onSelected, this.onUseCurrentLocation});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: () async {
        final place = await showModalBottomSheet<Place>(
          context: context,
          isScrollControlled: true,
          useSafeArea: true,
          builder: (_) => PlaceSearchSheet(hint: hint, onUseCurrentLocation: onUseCurrentLocation),
        );
        if (place != null) onSelected(place);
      },
      child: InputDecorator(
        decoration: InputDecoration(
          prefixIcon: Icon(icon),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          isDense: true,
        ),
        child: Text(
          value?.label ?? hint,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: value == null ? theme.textTheme.bodyLarge?.copyWith(color: theme.hintColor) : theme.textTheme.bodyLarge,
        ),
      ),
    );
  }
}

class PlaceSearchSheet extends StatefulWidget {
  final String hint;
  final Future<Place?> Function()? onUseCurrentLocation;
  const PlaceSearchSheet({super.key, required this.hint, this.onUseCurrentLocation});

  @override
  State<PlaceSearchSheet> createState() => _PlaceSearchSheetState();
}

class _PlaceSearchSheetState extends State<PlaceSearchSheet> {
  final _controller = TextEditingController();
  Timer? _debounce;
  List<Place> _results = [];
  bool _loading = false;
  String? _error;

  void _onChanged(String q) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 450), () => _search(q));
  }

  Future<void> _search(String q) async {
    if (q.trim().length < 2) {
      setState(() => _results = []);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    final scope = AppScope.of(context);
    try {
      final near = scope.location.lastKnown;
      final results = await scope.api.searchPlaces(q, lat: near?.latitude, lng: near?.longitude);
      if (mounted) setState(() => _results = results);
    } catch (e) {
      if (mounted) setState(() => _error = e.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: SizedBox(
        height: MediaQuery.of(context).size.height * 0.75,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
              child: TextField(
                controller: _controller,
                autofocus: true,
                onChanged: _onChanged,
                onSubmitted: _search,
                textInputAction: TextInputAction.search,
                decoration: InputDecoration(
                  hintText: widget.hint,
                  prefixIcon: const Icon(Icons.search),
                  suffixIcon: _loading ? const Padding(padding: EdgeInsets.all(12), child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))) : null,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ),
            if (widget.onUseCurrentLocation != null)
              ListTile(
                leading: const Icon(Icons.my_location),
                title: const Text('Use my current location'),
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  final navigator = Navigator.of(context);
                  try {
                    final place = await widget.onUseCurrentLocation!();
                    if (place != null) navigator.pop(place);
                  } catch (e) {
                    messenger.showSnackBar(SnackBar(content: Text(e.toString())));
                  }
                },
              ),
            if (_error != null) Padding(padding: const EdgeInsets.all(16), child: Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error))),
            Expanded(
              child: ListView.builder(
                itemCount: _results.length,
                itemBuilder: (context, i) {
                  final p = _results[i];
                  return ListTile(
                    leading: const Icon(Icons.place_outlined),
                    title: Text(p.label),
                    subtitle: p.address.isEmpty ? null : Text(p.address, maxLines: 1, overflow: TextOverflow.ellipsis),
                    onTap: () => Navigator.of(context).pop(p),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
