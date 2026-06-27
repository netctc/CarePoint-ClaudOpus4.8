import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_discovery_state.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class FilterSortPage extends StatefulWidget {
  const FilterSortPage({super.key});

  @override
  State<FilterSortPage> createState() => _FilterSortPageState();
}

class _FilterSortPageState extends State<FilterSortPage> {
  late String _providerType;
  late String _specialty;
  late String _serviceMode;
  late String _country;
  late String _city;
  late String _sortBy;
  late bool _acceptsInsurance;
  late bool _arabicSupport;
  late String _availability;

  @override
  void initState() {
    super.initState();
    final ProviderDiscoveryState state = ProviderDiscoveryState.instance;
    _providerType = state.providerType;
    _specialty = state.specialty;
    _serviceMode = state.serviceMode;
    _country = state.country;
    _city = state.city;
    _sortBy = state.sortBy;
    _acceptsInsurance = state.acceptsInsurance;
    _arabicSupport = state.arabicSupport;
    _availability = state.availability;
  }

  List<String> get _availableSpecialties {
    return ProviderDiscoveryState.defaultSpecialties[_providerType] ?? <String>['All'];
  }

  List<String> get _availableCities {
    return ProviderDiscoveryState.defaultCities[_country] ?? <String>['All'];
  }

  void _apply() {
    ProviderDiscoveryState.instance.update(
      providerType: _providerType,
      specialty: _specialty,
      serviceMode: _serviceMode,
      country: _country,
      city: _city,
      sortBy: _sortBy,
      acceptsInsurance: _acceptsInsurance,
      arabicSupport: _arabicSupport,
      availability: _availability,
    );
    context.go('/providers/search');
  }

  void _reset() {
    setState(() {
      _providerType = 'All';
      _specialty = 'All';
      _serviceMode = 'All';
      _country = 'All';
      _city = 'All';
      _sortBy = 'Earliest slot';
      _acceptsInsurance = false;
      _arabicSupport = false;
      _availability = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: 'Filters & sorting',
      subtitle: 'Refine provider results by type, specialty, location, and availability.',
      actions: <Widget>[
        TextButton(onPressed: _reset, child: const Text('Reset all')),
      ],
      bottomAction: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: AppPrimaryButton(label: 'Apply filters', icon: Icons.check, onPressed: _apply),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: 'Personalize discovery',
            title: 'Filter results',
            subtitle: 'Keep only the providers that fit your care context and booking preference.',
          ),
          const SizedBox(height: 18),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                // Provider type
                _DropdownSection(
                  title: 'Provider type',
                  value: _providerType,
                  items: ProviderDiscoveryState.defaultProviderTypes,
                  onChanged: (String value) => setState(() {
                    _providerType = value;
                    _specialty = 'All';
                  }),
                ),
                const SizedBox(height: 18),

                // Specialty
                _DropdownSection(
                  title: 'Specialty',
                  value: _specialty,
                  items: _availableSpecialties,
                  onChanged: (String value) => setState(() => _specialty = value),
                ),
                const SizedBox(height: 18),

                // Country
                _DropdownSection(
                  title: 'Country',
                  value: _country,
                  items: ProviderDiscoveryState.defaultCountries,
                  onChanged: (String value) => setState(() {
                    _country = value;
                    _city = 'All';
                  }),
                ),
                const SizedBox(height: 18),

                // City
                _DropdownSection(
                  title: 'City',
                  value: _city,
                  items: _availableCities,
                  onChanged: (String value) => setState(() => _city = value),
                ),
                const SizedBox(height: 18),

                // Availability
                Text('Availability', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 10),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: <Widget>[
                    _AvailabilityChip(label: 'Immediately', value: 'immediately', current: _availability, onSelected: (String v) => setState(() => _availability = v)),
                    _AvailabilityChip(label: 'Within 24h', value: '24h', current: _availability, onSelected: (String v) => setState(() => _availability = v)),
                    _AvailabilityChip(label: 'Within 48h', value: '48h', current: _availability, onSelected: (String v) => setState(() => _availability = v)),
                  ],
                ),
                const SizedBox(height: 18),

                // Service mode
                _ChoiceBlock<String>(
                  title: 'Service mode',
                  value: _serviceMode,
                  values: ProviderDiscoveryState.defaultServiceModes,
                  onChanged: (String value) => setState(() => _serviceMode = value),
                ),
                const SizedBox(height: 18),

                // Sort by
                _ChoiceBlock<String>(
                  title: 'Sort by',
                  value: _sortBy,
                  values: const <String>['Earliest slot', 'Highest rated', 'Lowest price'],
                  onChanged: (String value) => setState(() => _sortBy = value),
                ),
                const SizedBox(height: 18),

                // Toggles
                SwitchListTile.adaptive(
                  value: _acceptsInsurance,
                  onChanged: (bool value) => setState(() => _acceptsInsurance = value),
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Accepts insurance'),
                  subtitle: const Text('Providers that work with insured care flows.'),
                ),
                SwitchListTile.adaptive(
                  value: _arabicSupport,
                  onChanged: (bool value) => setState(() => _arabicSupport = value),
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Arabic language support'),
                  subtitle: const Text('Providers with Arabic-ready patient communication.'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DropdownSection extends StatelessWidget {
  const _DropdownSection({required this.title, required this.value, required this.items, required this.onChanged});

  final String title;
  final String value;
  final List<String> items;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        SizedBox(
          width: double.infinity,
          child: DropdownButtonFormField<String>(
            value: items.contains(value) ? value : items.first,
            decoration: InputDecoration(
              border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
            items: items.map((String item) => DropdownMenuItem<String>(value: item, child: Text(item))).toList(),
            onChanged: (String? v) { if (v != null) onChanged(v); },
          ),
        ),
      ],
    );
  }
}

class _AvailabilityChip extends StatelessWidget {
  const _AvailabilityChip({required this.label, required this.value, required this.current, required this.onSelected});

  final String label;
  final String value;
  final String current;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final bool selected = current == value;
    return FilterChip(
      label: Text(label),
      selected: selected,
      onSelected: (_) => onSelected(selected ? '' : value),
    );
  }
}

class _ChoiceBlock<T> extends StatelessWidget {
  const _ChoiceBlock({required this.title, required this.value, required this.values, required this.onChanged});

  final String title;
  final T value;
  final List<T> values;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: values
              .map(
                (T item) => ChoiceChip(
                  label: Text(item.toString()),
                  selected: item == value,
                  onSelected: (_) => onChanged(item),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}
