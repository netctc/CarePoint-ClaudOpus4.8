import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderAnalyticsPage extends StatefulWidget {
  const ProviderAnalyticsPage({super.key});

  @override
  State<ProviderAnalyticsPage> createState() => _ProviderAnalyticsPageState();
}

class _ProviderAnalyticsPageState extends State<ProviderAnalyticsPage> {
  late Future<Map<String, dynamic>> _future;
  String _location = '';

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.analyticsOverview();
  }

  void _refresh() => setState(() => _future = ProviderSession.instance.api.analyticsOverview(location: _location.isEmpty ? null : _location));

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final Map<String, dynamic> raw = snapshot.data ?? <String, dynamic>{};
        final Map<String, dynamic> overview = raw;
        final List<dynamic> metrics = raw['metrics'] is List ? raw['metrics'] as List<dynamic> : const <dynamic>[];
        final List<dynamic> facilityBreakdown = raw['facilityBreakdown'] is List ? raw['facilityBreakdown'] as List<dynamic> : const <dynamic>[];
        final Map<String, dynamic> hspAccess = pickMap(raw, const <String>['hspAccess']);
        final List<Map<String, String>> facilityOptions = <Map<String, String>>[];
        void addFacility(dynamic value) {
          final Map<String, dynamic> facility = value is Map ? Map<String, dynamic>.from(value.cast<dynamic, dynamic>()) : <String, dynamic>{};
          final String name = readString(facility, const <String>['name'], fallback: '');
          if (name.isEmpty) return;
          if (facilityOptions.any((Map<String, String> item) => item['value'] == name)) return;
          facilityOptions.add(<String, String>{'label': name, 'value': name});
        }
        addFacility(hspAccess['primaryFacility']);
        final List<dynamic> consented = hspAccess['consentedFacilities'] is List ? hspAccess['consentedFacilities'] as List<dynamic> : const <dynamic>[];
        final List<dynamic> assigned = hspAccess['assignedFacilities'] is List ? hspAccess['assignedFacilities'] as List<dynamic> : const <dynamic>[];
        for (final dynamic item in <dynamic>[...assigned, ...consented]) { addFacility(item); }

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Analytics overview',
                  subtitle: 'Provider performance, activity, and operational insight cards adapted for mobile consumption.',
                  badge: 'Insights',
                ),
                const SizedBox(height: 20),
                Row(
                  children: <Widget>[
                    Expanded(child: Text(_location.isEmpty ? 'All accessible facilities' : _location, style: Theme.of(context).textTheme.titleMedium)),
                    if (facilityOptions.isNotEmpty)
                      DropdownButton<String>(
                        value: _location.isEmpty ? '' : _location,
                        items: <DropdownMenuItem<String>>[
                          const DropdownMenuItem<String>(value: '', child: Text('All')),
                          ...facilityOptions.map((Map<String, String> item) => DropdownMenuItem<String>(value: item['value'], child: Text(item['label'] ?? 'Facility'))),
                        ],
                        onChanged: (String? value) {
                          setState(() {
                            _location = value ?? '';
                            _future = ProviderSession.instance.api.analyticsOverview(location: _location.isEmpty ? null : _location);
                          });
                        },
                      ),
                  ],
                ),
                const SizedBox(height: 16),
                if (metrics.isEmpty)
                  const EmptyStateCard(title: 'No analytics snapshot', subtitle: 'Analytics metrics will appear here when available.', icon: Icons.query_stats_outlined)
                else
                  GridView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: metrics.length,
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: 12,
                      crossAxisSpacing: 12,
                      childAspectRatio: 1.35,
                    ),
                    itemBuilder: (context, index) {
                      final Map<String, dynamic> entry = metrics[index] is Map ? Map<String, dynamic>.from((metrics[index] as Map).cast<dynamic, dynamic>()) : <String, dynamic>{};
                      return MetricCard(label: readString(entry, const <String>['label'], fallback: 'Metric'), value: readString(entry, const <String>['value'], fallback: '0'));
                    },
                  ),
                if (facilityBreakdown.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 20),
                  const SectionTitle(title: 'Facility breakdown'),
                  const SizedBox(height: 12),
                  ...facilityBreakdown.map((dynamic item) {
                    final Map<String, dynamic> facility = item is Map ? Map<String, dynamic>.from((item as Map).cast<dynamic, dynamic>()) : <String, dynamic>{};
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ProviderCard(
                        child: Row(
                          children: <Widget>[
                            Expanded(child: Text(readString(facility, const <String>['location'], fallback: 'Facility'))),
                            StatusBadge('${facility['count'] ?? 0}'),
                          ],
                        ),
                      ),
                    );
                  }),
                ],
              ],
            ),
          ),
        );
      },
    );
  }
}
