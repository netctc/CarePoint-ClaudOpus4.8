import 'package:flutter/material.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderHspAccessPage extends StatefulWidget {
  const ProviderHspAccessPage({super.key});

  @override
  State<ProviderHspAccessPage> createState() => _ProviderHspAccessPageState();
}

class _ProviderHspAccessPageState extends State<ProviderHspAccessPage> {
  late Future<Map<String, dynamic>> _future;
  String _status = 'ALL';

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'summary': await api.hspAccessSummary(),
      'grants': await api.hspConsentGrants(status: _status),
    };
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ProviderPage(child: LoadingBlock());
        }
        if (snapshot.hasError) {
          return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        }
        final Map<String, dynamic> summary = pickMap(snapshot.data?['summary'], const <String>['item']);
        final Map<String, dynamic> grantsRoot = pickMap(snapshot.data?['grants'], const <String>['item']);
        final List<Map<String, dynamic>> grants = pickList(grantsRoot, const <String>['grants']);
        final List<Map<String, dynamic>> facilities = pickList(summary, const <String>['consentedFacilities']);
        final List<dynamic> restrictions = summary['restrictions'] is List ? summary['restrictions'] as List<dynamic> : const <dynamic>[];

        return ProviderPage(
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'HSP access model',
                  subtitle: 'Review account model, facility scope, and explicit cross-facility consent paths for this provider account.',
                  badge: 'Governance',
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _InfoRow(label: 'Account model', value: readString(summary, const <String>['accountModelLabel'], fallback: 'Unknown')),
                      _InfoRow(label: 'Access scope', value: readString(summary, const <String>['accessScopeLabel'], fallback: 'Unknown')),
                      _InfoRow(label: 'Consent scope', value: readString(summary, const <String>['consentScopeLabel'], fallback: 'Unknown')),
                      _InfoRow(label: 'Primary facility', value: readString(pickMap(summary, const <String>['primaryFacility']), const <String>['name'], fallback: 'Not assigned')),
                      _InfoRow(label: 'Active grants', value: readString(summary, const <String>['consentGrantsCount'], fallback: '0')),
                      _InfoRow(label: 'Granted domains', value: _domainsLabel(summary['grantedDomains'])),
                      const SizedBox(height: 8),
                      Text(readString(summary, const <String>['summaryText'], fallback: ''), style: Theme.of(context).textTheme.bodyMedium),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: Theme.of(context).colorScheme.surfaceContainerHighest,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Text(
                          'Facility-scoped API enforcement is active for calendar, labs, analytics, prescriptions, orders, and RPM. Cross-center access only works when the facility is allowed and the required data domain is granted.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Domain enforcement'),
                const SizedBox(height: 12),
                ProviderCard(
                  child: _DomainEnforcementList(map: pickMap(summary, const <String>['enforcementStatusByDomain'])),
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Restrictions'),
                const SizedBox(height: 12),
                ProviderCard(
                  child: restrictions.isEmpty
                      ? const Text('No additional restrictions are currently listed.')
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: restrictions.map((dynamic item) => Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                const Padding(
                                  padding: EdgeInsets.only(top: 2),
                                  child: Icon(Icons.gpp_maybe_outlined, size: 18),
                                ),
                                const SizedBox(width: 10),
                                Expanded(child: Text(item.toString())),
                              ],
                            ),
                          )).toList(),
                        ),
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Consented facilities'),
                const SizedBox(height: 12),
                if (facilities.isEmpty)
                  const EmptyStateCard(title: 'No consented facilities', subtitle: 'Cross-facility access is currently limited to the primary facility.', icon: Icons.location_off_outlined)
                else
                  ...facilities.map((facility) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: ProviderCard(
                      child: Row(
                        children: <Widget>[
                          const CircleAvatar(child: Icon(Icons.apartment_rounded)),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(readString(facility, const <String>['name'], fallback: 'Facility'), style: Theme.of(context).textTheme.titleMedium),
                                const SizedBox(height: 4),
                                Text('${readString(facility, const <String>['city'], fallback: 'Unknown city')} • ${readString(facility, const <String>['kind'], fallback: 'Facility')}'),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  )),
                const SizedBox(height: 20),
                Row(
                  children: <Widget>[
                    const Expanded(child: SectionTitle(title: 'Consent grants')),
                    DropdownButton<String>(
                      value: _status,
                      items: const <DropdownMenuItem<String>>[
                        DropdownMenuItem(value: 'ALL', child: Text('All')),
                        DropdownMenuItem(value: 'ACTIVE', child: Text('Active')),
                        DropdownMenuItem(value: 'REVOKED', child: Text('Revoked')),
                      ],
                      onChanged: (String? value) {
                        if (value == null) return;
                        setState(() {
                          _status = value;
                          _future = _load();
                        });
                      },
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                if (grants.isEmpty)
                  const EmptyStateCard(title: 'No consent grants recorded', subtitle: 'Once your organization records inter-center access, grants will appear here.', icon: Icons.assignment_late_outlined)
                else
                  ...grants.map((grant) {
                    final String note = readString(grant, const <String>['note'], fallback: '');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: ProviderCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Expanded(
                                  child: Text(
                                    '${readString(grant, const <String>['sourceFacilityName'], fallback: 'Source')} → ${readString(grant, const <String>['targetFacilityName'], fallback: 'Target')}',
                                    style: Theme.of(context).textTheme.titleMedium,
                                  ),
                                ),
                                StatusBadge(readString(grant, const <String>['status'], fallback: 'Recorded')),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text('${readString(grant, const <String>['scope'], fallback: 'LIMITED')} • ${_domainsLabel(grant['domains'])}'),
                            const SizedBox(height: 6),
                            Text(formatDateTimeLabel(readString(grant, const <String>['updatedAt'], fallback: ''))),
                            if (note.isNotEmpty) ...<Widget>[
                              const SizedBox(height: 8),
                              Text(note, style: Theme.of(context).textTheme.bodySmall),
                            ],
                          ],
                        ),
                      ),
                    );
                  }),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          const SizedBox(width: 12),
          Flexible(child: Text(value, textAlign: TextAlign.end, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600))),
        ],
      ),
    );
  }
}

String _domainsLabel(dynamic value) {
  if (value is! List || value.isEmpty) return 'All approved domains';
  return value.map((dynamic item) => item.toString()).join(', ');
}

class _DomainEnforcementList extends StatelessWidget {
  const _DomainEnforcementList({required this.map});

  final Map<String, dynamic> map;

  @override
  Widget build(BuildContext context) {
    if (map.isEmpty) {
      return const Text('No domain enforcement metadata reported.');
    }
    final entries = map.entries.toList()..sort((a, b) => a.key.compareTo(b.key));
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: entries.map((entry) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Row(
          children: <Widget>[
            Expanded(child: Text(entry.key, style: Theme.of(context).textTheme.bodyMedium)),
            StatusBadge(entry.value.toString()),
          ],
        ),
      )).toList(),
    );
  }
}
