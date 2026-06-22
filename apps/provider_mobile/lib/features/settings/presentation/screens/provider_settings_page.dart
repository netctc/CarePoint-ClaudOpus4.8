import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/offline_action_queue.dart';
import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderSettingsPage extends StatefulWidget {
  const ProviderSettingsPage({super.key});

  @override
  State<ProviderSettingsPage> createState() => _ProviderSettingsPageState();
}

class _ProviderSettingsPageState extends State<ProviderSettingsPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'summary': await api.settingsSummary(),
      'facilities': await api.settingsFacilities(),
    };
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: OfflineActionQueue.instance,
      builder: (BuildContext context, _) {
        final OfflineActionQueue queue = OfflineActionQueue.instance;
        return FutureBuilder<Map<String, dynamic>>(
          future: _future,
          builder: (context, snapshot) {
            if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
            if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
            final Map<String, dynamic> summary = pickMap(snapshot.data?['summary'], const <String>['summary', 'overview']);
            final Map<String, dynamic> hspAccess = pickMap(ProviderSession.instance.me, const <String>['hspAccess']);
            final List<Map<String, dynamic>> facilities = pickList(snapshot.data?['facilities'], const <String>['facilities', 'items']);
            return SafeArea(
              top: false,
              child: RefreshIndicator(
                onRefresh: () async => _refresh(),
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
                  children: <Widget>[
                    const ProviderHeroCard(
                      title: 'Provider settings',
                      subtitle: 'Facility configuration, notification controls, and offline workflow management for the provider mobile application.',
                      badge: 'Configuration',
                    ),
                    const SizedBox(height: 20),
                    ProviderCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: <Widget>[
                          for (final entry in summary.entries.where((entry) => entry.value is! Map && entry.value is! List))
                            Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: Row(
                                children: <Widget>[
                                  Expanded(child: Text(titleCaseKey(entry.key))),
                                  Text(entry.value.toString()),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    if (hspAccess.isNotEmpty) ...<Widget>[
                      const SectionTitle(title: 'HSP access model'),
                      const SizedBox(height: 12),
                      ProviderCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            _InfoRow(label: 'Account model', value: readString(hspAccess, const <String>['accountModelLabel'], fallback: 'Unknown')),
                            _InfoRow(label: 'Access scope', value: readString(hspAccess, const <String>['accessScopeLabel'], fallback: 'Unknown')),
                            _InfoRow(label: 'Primary facility', value: readString(pickMap(hspAccess, const <String>['primaryFacility']), const <String>['name'], fallback: 'Not assigned')),
                            _InfoRow(label: 'Consent scope', value: readString(hspAccess, const <String>['consentScopeLabel'], fallback: 'Unknown')),
                            const SizedBox(height: 8),
                            Text(readString(hspAccess, const <String>['summaryText'], fallback: ''), style: Theme.of(context).textTheme.bodyMedium),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],
                    const SectionTitle(title: 'Mobile controls'),
                    const SizedBox(height: 12),
                    ProviderCard(
                      child: Column(
                        children: <Widget>[
                          _SettingsActionTile(
                            icon: Icons.notifications_active_outlined,
                            title: 'Notification preferences',
                            subtitle: 'Adjust local alert categories while push registration endpoints are finalized.',
                            trailingLabel: 'Open',
                            onTap: () => context.go('/settings/notifications'),
                          ),
                          const Divider(height: 24),
                          _SettingsActionTile(
                            icon: Icons.badge_outlined,
                            title: 'Onboarding and credentials',
                            subtitle: 'Complete provider onboarding, attestations, and payout details.',
                            trailingLabel: 'Open',
                            onTap: () => context.go('/settings/onboarding'),
                          ),
                          const Divider(height: 24),
                          _SettingsActionTile(
                            icon: Icons.hub_outlined,
                            title: 'HSP access model',
                            subtitle: 'Review organization linkage, primary facility scope, and explicit cross-facility consent paths.',
                            trailingLabel: readString(hspAccess, const <String>['consentGrantsCount'], fallback: 'Open'),
                            onTap: () => context.go('/settings/hsp-access'),
                          ),
                          const Divider(height: 24),
                          _SettingsActionTile(
                            icon: Icons.sync_problem_outlined,
                            title: 'Offline action queue',
                            subtitle: queue.pendingCount == 0
                                ? 'No queued actions. Failed mutations will appear here for retry.'
                                : '${queue.pendingCount} action${queue.pendingCount == 1 ? '' : 's'} waiting to retry.',
                            trailingLabel: queue.pendingCount == 0 ? 'View' : '${queue.pendingCount}',
                            onTap: () => context.go('/settings/offline-queue'),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                    const SectionTitle(title: 'Facilities'),
                    const SizedBox(height: 12),
                    if (facilities.isEmpty)
                      const EmptyStateCard(title: 'No facilities found', subtitle: 'Configured provider facilities will appear here.', icon: Icons.local_hospital_outlined)
                    else
                      ...facilities.map((facility) {
                        final String facilityId = readString(facility, const <String>['id'], fallback: '');
                        return Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: InkWell(
                              borderRadius: BorderRadius.circular(24),
                              onTap: facilityId.isEmpty || facilityId == '—' ? null : () => context.go('/settings/facilities/$facilityId'),
                              child: ProviderCard(
                                child: Row(
                                  children: <Widget>[
                                    const CircleAvatar(child: Icon(Icons.apartment_rounded)),
                                    const SizedBox(width: 12),
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: <Widget>[
                                          Text(readString(facility, const <String>['name', 'facilityName'], fallback: 'Facility'), style: Theme.of(context).textTheme.titleMedium),
                                          const SizedBox(height: 4),
                                          Text(readString(facility, const <String>['address', 'city', 'location'], fallback: 'Address unavailable')),
                                          const SizedBox(height: 6),
                                          Text(
                                            readListLabel(facility['serviceModes']),
                                            style: Theme.of(context).textTheme.bodySmall,
                                          ),
                                        ],
                                      ),
                                    ),
                                    Column(
                                      crossAxisAlignment: CrossAxisAlignment.end,
                                      children: <Widget>[
                                        StatusBadge(readString(facility, const <String>['publishStatus', 'status'], fallback: 'Configured')),
                                        const SizedBox(height: 10),
                                        const Icon(Icons.chevron_right_rounded),
                                      ],
                                    ),
                                  ],
                                ),
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

class _SettingsActionTile extends StatelessWidget {
  const _SettingsActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.trailingLabel,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final String trailingLabel;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(18),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(
          children: <Widget>[
            CircleAvatar(child: Icon(icon)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(title, style: Theme.of(context).textTheme.titleMedium),
                  const SizedBox(height: 4),
                  Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
                ],
              ),
            ),
            const SizedBox(width: 12),
            Text(trailingLabel, style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(width: 4),
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}

String readListLabel(dynamic value) {
  if (value is! List || value.isEmpty) return 'No service modes listed';
  return value.map((dynamic item) => item.toString()).join(' • ');
}
