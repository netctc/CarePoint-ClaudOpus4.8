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
  late String _serviceMode;
  late String _city;
  late String _sortBy;
  late bool _acceptsInsurance;
  late bool _arabicSupport;

  @override
  void initState() {
    super.initState();
    final ProviderDiscoveryState state = ProviderDiscoveryState.instance;
    _serviceMode = state.serviceMode;
    _city = state.city;
    _sortBy = state.sortBy;
    _acceptsInsurance = state.acceptsInsurance;
    _arabicSupport = state.arabicSupport;
  }

  void _apply() {
    final String city = _serviceMode == 'Online' ? 'Any' : _city;
    ProviderDiscoveryState.instance.update(
      serviceMode: _serviceMode,
      city: city,
      sortBy: _sortBy,
      acceptsInsurance: _acceptsInsurance,
      arabicSupport: _arabicSupport,
    );
    context.go('/providers/search');
  }

  @override
  Widget build(BuildContext context) {
    return PatientScaffold(
      showNavigation: false,
      showBack: true,
      title: 'Filters & sorting',
      subtitle: 'Refine provider results by access mode, city, language, and ranking.',
      actions: <Widget>[
        TextButton(
          onPressed: () {
            ProviderDiscoveryState.instance.reset();
            context.go('/providers/search');
          },
          child: const Text('Reset'),
        ),
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
                _ChoiceBlock<String>(
                  title: 'Service mode',
                  value: _serviceMode,
                  values: const <String>['Both', 'Online', 'In-Person'],
                  onChanged: (String value) => setState(() {
                    _serviceMode = value;
                    if (value == 'Online') _city = 'Any';
                  }),
                ),
                if (_serviceMode != 'Online') ...<Widget>[
                  const SizedBox(height: 18),
                  _ChoiceBlock<String>(
                    title: 'City',
                    value: _city,
                    values: const <String>['Any', 'Riyadh', 'Jeddah', 'Dammam'],
                    onChanged: (String value) => setState(() => _city = value),
                  ),
                ],
                const SizedBox(height: 18),
                _ChoiceBlock<String>(
                  title: 'Sort by',
                  value: _sortBy,
                  values: const <String>['Earliest slot', 'Highest rated', 'Lowest price'],
                  onChanged: (String value) => setState(() => _sortBy = value),
                ),
                const SizedBox(height: 18),
                SwitchListTile.adaptive(
                  value: _acceptsInsurance,
                  onChanged: (bool value) => setState(() => _acceptsInsurance = value),
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Accepts insurance'),
                  subtitle: const Text('Prioritize providers that work with insured care flows.'),
                ),
                SwitchListTile.adaptive(
                  value: _arabicSupport,
                  onChanged: (bool value) => setState(() => _arabicSupport = value),
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Arabic language support'),
                  subtitle: const Text('Show providers and facilities with Arabic-ready patient communication.'),
                ),
              ],
            ),
          ),
        ],
      ),
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
