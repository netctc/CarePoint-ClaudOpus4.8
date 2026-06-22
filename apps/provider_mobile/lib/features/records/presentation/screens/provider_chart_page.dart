import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderChartPage extends StatefulWidget {
  const ProviderChartPage({
    required this.patientId,
    this.patientName,
    this.subjectProfileId,
    this.subjectLabel,
    this.subjectRelationship,
    super.key,
  });

  final String patientId;
  final String? patientName;
  final String? subjectProfileId;
  final String? subjectLabel;
  final String? subjectRelationship;

  @override
  State<ProviderChartPage> createState() => _ProviderChartPageState();
}

class _ProviderChartPageState extends State<ProviderChartPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'records': await api.records(patientId: widget.patientId, subjectProfileId: widget.subjectProfileId),
      'access': await api.chartAccessContext(patientId: widget.patientId, subjectProfileId: widget.subjectProfileId),
      'orders': await api.orders(patientId: widget.patientId, subjectProfileId: widget.subjectProfileId),
      'prescriptions': await api.prescriptions(patientId: widget.patientId, subjectProfileId: widget.subjectProfileId),
    };
  }

  void _refresh() => setState(() => _future = _load());

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const ProviderPage(child: LoadingBlock());
        }
        if (snapshot.hasError) {
          return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        }

        final List<Map<String, dynamic>> records = pickList(snapshot.data?['records'], const <String>['items', 'records']);
        final Map<String, dynamic> access = pickMap(snapshot.data?['access'], const <String>['item', 'data']);
        final List<Map<String, dynamic>> orders = pickList(snapshot.data?['orders'], const <String>['items', 'orders']);
        final List<Map<String, dynamic>> prescriptions = pickList(snapshot.data?['prescriptions'], const <String>['items', 'prescriptions']);

        final String accessPath = readString(access, const <String>['accessPath'], fallback: 'Assigned provider');
        final String guidance = readString(
          access,
          const <String>['guidance'],
          fallback: 'Access granted within provider scope for clinical review.',
        );
        final Map<String, dynamic> subject = pickMap(access, const <String>['subject']);
        final String resolvedName = widget.subjectLabel?.trim().isNotEmpty == true
            ? widget.subjectLabel!.trim()
            : widget.patientName?.trim().isNotEmpty == true
                ? widget.patientName!.trim()
                : readString(subject, const <String>['name'], fallback: readString(records.isEmpty ? const <String, dynamic>{} : records.first, const <String>['patientName'], fallback: 'Patient'));
        final String relationship = widget.subjectRelationship?.trim().isNotEmpty == true
            ? widget.subjectRelationship!.trim()
            : readString(subject, const <String>['relationship'], fallback: '');

        final Map<String, String?> contextSource = <String, String?>{
          'patientId': widget.patientId,
          'appointmentId': null,
          'patientName': resolvedName,
          'subjectProfileId': widget.subjectProfileId,
          'subjectLabel': widget.subjectLabel,
          'subjectRelationship': widget.subjectRelationship,
        };

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: resolvedName,
                  subtitle: relationship.isEmpty
                      ? 'Clinical chart summary with access context, recent records, orders, and prescriptions.'
                      : '$relationship chart summary with access context, recent records, orders, and prescriptions.',
                  badge: accessPath.replaceAll('_', ' '),
                  trailing: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      FilledButton.icon(
                        onPressed: () => context.go(buildAppRoute('/encounters/new', queryParameters: contextSource)),
                        icon: const Icon(Icons.edit_note_rounded),
                        label: const Text('Encounter note'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => context.go(buildAppRoute('/orders/new', queryParameters: contextSource)),
                        icon: const Icon(Icons.science_rounded),
                        label: const Text('Create order'),
                      ),
                      OutlinedButton.icon(
                        onPressed: () => context.go(buildAppRoute('/prescriptions/new', queryParameters: contextSource)),
                        icon: const Icon(Icons.medication_rounded),
                        label: const Text('Prescription'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          const Icon(Icons.verified_user_rounded),
                          const SizedBox(width: 10),
                          Expanded(child: Text(guidance, style: Theme.of(context).textTheme.bodyMedium)),
                        ],
                      ),
                      if (relationship.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 12),
                        Text('Subject relationship: $relationship', style: Theme.of(context).textTheme.bodyMedium),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.4,
                  children: <Widget>[
                    MetricCard(label: 'Clinical records', value: '${records.length}'),
                    MetricCard(label: 'Open orders', value: '${orders.length}', variant: MetricVariant.warning),
                    MetricCard(label: 'Prescriptions', value: '${prescriptions.length}', variant: MetricVariant.success),
                    MetricCard(label: 'Access path', value: accessPath.replaceAll('_', ' ')),
                  ],
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Recent chart activity'),
                const SizedBox(height: 12),
                if (records.isEmpty)
                  const EmptyStateCard(
                    title: 'No clinical records available',
                    subtitle: 'Signed encounter notes, prescription releases, and other records will appear here.',
                    icon: Icons.description_outlined,
                  )
                else
                  ...records.take(8).map((record) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: InkWell(
                          onTap: () => context.go(buildRecordDetailRoute(record)),
                          child: ProviderCard(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Row(
                                  children: <Widget>[
                                    Expanded(
                                      child: Text(
                                        readString(record, const <String>['title', 'summaryTitle', 'recordType'], fallback: 'Clinical record'),
                                        style: Theme.of(context).textTheme.titleMedium,
                                      ),
                                    ),
                                    StatusBadge(readString(record, const <String>['noteStatus', 'recordType', 'status'], fallback: 'Available')),
                                  ],
                                ),
                                const SizedBox(height: 8),
                                Text(readString(record, const <String>['summary', 'type'], fallback: 'Clinical entry')),
                                const SizedBox(height: 8),
                                Text(formatDateTimeLabel(readString(record, const <String>['createdAt', 'updatedAt'], fallback: ''))),
                                const SizedBox(height: 12),
                                Align(
                                  alignment: Alignment.centerRight,
                                  child: OutlinedButton(
                                    onPressed: () => context.go(buildRecordDetailRoute(record)),
                                    child: const Text('Open record'),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Orders and prescriptions'),
                const SizedBox(height: 12),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      if (orders.isNotEmpty) ...<Widget>[
                        Text('Recent orders', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 12),
                        for (final Map<String, dynamic> item in orders.take(3))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: InkWell(
                              onTap: () {
                                final String id = readString(item, const <String>['id'], fallback: '');
                                if (id.isNotEmpty && id != '—') context.go('/orders/$id');
                              },
                              child: Row(
                                children: <Widget>[
                                  const Icon(Icons.science_rounded),
                                  const SizedBox(width: 10),
                                  Expanded(child: Text(readString(item, const <String>['title', 'reason'], fallback: 'Clinical order'))),
                                  StatusBadge(readString(item, const <String>['status'], fallback: 'Draft')),
                                ],
                              ),
                            ),
                          ),
                      ],
                      if (orders.isNotEmpty && prescriptions.isNotEmpty) const Divider(height: 24),
                      if (prescriptions.isNotEmpty) ...<Widget>[
                        Text('Recent prescriptions', style: Theme.of(context).textTheme.titleMedium),
                        const SizedBox(height: 12),
                        for (final Map<String, dynamic> item in prescriptions.take(3))
                          Padding(
                            padding: const EdgeInsets.only(bottom: 10),
                            child: InkWell(
                              onTap: () {
                                final String id = readString(item, const <String>['id'], fallback: '');
                                if (id.isNotEmpty && id != '—') context.go('/prescriptions/$id');
                              },
                              child: Row(
                                children: <Widget>[
                                  const Icon(Icons.medication_rounded),
                                  const SizedBox(width: 10),
                                  Expanded(child: Text(readString(item, const <String>['title', 'drug'], fallback: 'Prescription'))),
                                  StatusBadge(readString(item, const <String>['status'], fallback: 'Draft')),
                                ],
                              ),
                            ),
                          ),
                      ],
                      if (orders.isEmpty && prescriptions.isEmpty)
                        const EmptyStateCard(
                          title: 'No related orders or prescriptions',
                          subtitle: 'Create clinical orders and prescriptions directly from this chart.',
                          icon: Icons.medical_services_outlined,
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
