import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/app_session.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/state/provider_discovery_state.dart';
import '../../../../core/widgets/app_text_field.dart';
import '../../../../core/widgets/patient_ui.dart';
import '../widgets/provider_result_card.dart';

class SearchProvidersPage extends StatefulWidget {
  const SearchProvidersPage({super.key});

  @override
  State<SearchProvidersPage> createState() => _SearchProvidersPageState();
}

class _SearchProvidersPageState extends State<SearchProvidersPage> {
  late final TextEditingController _searchController;
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _searchController = TextEditingController(text: ProviderDiscoveryState.instance.query);
    _future = AppSession.instance.providers(_searchController.text);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  void _runSearch() {
    ProviderDiscoveryState.instance.update(query: _searchController.text.trim());
    setState(() { _future = AppSession.instance.providers(_searchController.text.trim()); });
  }

  List<Map<String, dynamic>> _applyFilters(List<dynamic> items) {
    final ProviderDiscoveryState filters = ProviderDiscoveryState.instance;
    final List<Map<String, dynamic>> providers = items.whereType<Map<String, dynamic>>().map((Map<String, dynamic> item) => Map<String, dynamic>.from(item)).toList();

    final Iterable<Map<String, dynamic>> filtered = providers.where((Map<String, dynamic> provider) {
      final String serviceMode = provider['serviceMode']?.toString() ?? 'Both';
      final List<String> locations = (provider['locations'] as List<dynamic>? ?? <dynamic>[]).map((dynamic e) => e.toString()).toList();
      final bool serviceModeMatches = filters.serviceMode == 'Both' || serviceMode == filters.serviceMode || serviceMode == 'Both';
      final bool cityMatches = filters.serviceMode == 'Online' || filters.city == 'Any' || locations.any((String location) => location.toLowerCase().contains(filters.city.toLowerCase()));
      return serviceModeMatches && cityMatches;
    });

    final List<Map<String, dynamic>> result = filtered.toList();
    result.sort((Map<String, dynamic> a, Map<String, dynamic> b) {
      switch (filters.sortBy) {
        case 'Highest rated':
          return (b['rating'] as num? ?? 4.8).compareTo(a['rating'] as num? ?? 4.8);
        case 'Lowest price':
          return (a['consultationFeeMinor'] as num? ?? 32000).compareTo(b['consultationFeeMinor'] as num? ?? 32000);
        default:
          return (a['nextAvailableLabel']?.toString() ?? '').compareTo(b['nextAvailableLabel']?.toString() ?? '');
      }
    });
    return result;
  }

  void _openProvider(Map<String, dynamic> provider) {
    BookingDraft.instance.reset();
    BookingDraft.instance.hydrateFromProvider(provider);
    context.go('/providers/profile');
  }

  @override
  Widget build(BuildContext context) {
    final ProviderDiscoveryState discovery = ProviderDiscoveryState.instance;

    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: 'Find care',
      subtitle: 'Search, compare, and choose a provider before booking.',
      actions: <Widget>[
        IconButton.filledTonal(
          onPressed: () => context.go('/providers/filter'),
          icon: const Icon(Icons.tune),
        ),
      ],
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          final List<Map<String, dynamic>> items = _applyFilters(snapshot.data?['items'] as List<dynamic>? ?? <dynamic>[]);
          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
            children: <Widget>[
              PatientHeroCard(
                badge: '${items.length} providers available',
                title: 'Provider search',
                subtitle: 'Discover clinicians, compare access modes, and continue into a guided booking flow.',
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: <Widget>[
                    PatientTag(label: discovery.serviceMode, icon: Icons.sync_alt_outlined),
                    PatientTag(label: discovery.city, icon: Icons.location_city_outlined),
                    PatientTag(label: discovery.sortBy, icon: Icons.swap_vert_outlined),
                  ],
                ),
              ),
              const SizedBox(height: 18),
              PatientCard(
                child: Column(
                  children: <Widget>[
                    AppTextField(
                      label: 'Search by specialty, provider, or service',
                      hintText: 'Family medicine',
                      controller: _searchController,
                      prefixIcon: Icons.search,
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: <Widget>[
                        Expanded(child: FilledButton(onPressed: _runSearch, child: const Text('Search'))),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => context.go('/providers/filter'),
                            icon: const Icon(Icons.filter_list_rounded),
                            label: const Text('Filters'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              const PatientSectionTitle(title: 'Recommended providers'),
              const SizedBox(height: 12),
              if (snapshot.connectionState != ConnectionState.done)
                const Padding(
                  padding: EdgeInsets.all(30),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (snapshot.hasError)
                PatientEmptyState(
                  title: 'Could not load providers',
                  body: snapshot.error.toString(),
                  icon: Icons.cloud_off_outlined,
                  action: FilledButton.tonal(onPressed: _runSearch, child: const Text('Try again')),
                ),
              if (snapshot.connectionState == ConnectionState.done && items.isEmpty)
                const PatientEmptyState(
                  title: 'No providers matched this search',
                  body: 'Try widening the query or reset the current filters to see more options.',
                  icon: Icons.search_off_rounded,
                ),
              ...items.map((Map<String, dynamic> provider) => Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: ProviderResultCard(
                      name: provider['name']?.toString() ?? 'Provider',
                      specialty: provider['specialty']?.toString() ?? 'General Practice',
                      serviceMode: provider['serviceMode']?.toString() ?? 'Both',
                      locations: (provider['locations'] as List<dynamic>? ?? <dynamic>['Virtual Care']).map((dynamic e) => e.toString()).toList(),
                      nextSlot: provider['nextAvailableLabel']?.toString(),
                      providerType: provider['hspModelLabel']?.toString() ?? provider['providerType']?.toString(),
                      onViewProfile: () => _openProvider(provider),
                    ),
                  )),
            ],
          );
        },
      ),
    );
  }
}
