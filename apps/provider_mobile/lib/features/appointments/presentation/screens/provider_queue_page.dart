import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderQueuePage extends StatefulWidget {
  const ProviderQueuePage({super.key});

  @override
  State<ProviderQueuePage> createState() => _ProviderQueuePageState();
}

class _ProviderQueuePageState extends State<ProviderQueuePage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.appointments();
  }

  void _refresh() {
    setState(() {
      _future = ProviderSession.instance.api.appointments();
    });
  }

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
        final List<Map<String, dynamic>> items = pickList(snapshot.data, const <String>['items', 'appointments', 'queue']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Provider queue',
                  subtitle: 'Review upcoming and in-progress appointments with direct access to appointment detail, patient context, and telehealth readiness.',
                  badge: 'Appointments',
                ),
                const SizedBox(height: 20),
                if (items.isEmpty)
                  const EmptyStateCard(title: 'No appointments found', subtitle: 'The provider queue is currently empty.')
                else
                  ...items.map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: <Widget>[
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: <Widget>[
                                        Text(readString(item, const <String>['patientName', 'subjectLabel']), style: Theme.of(context).textTheme.titleMedium),
                                        const SizedBox(height: 4),
                                        Text(readString(item, const <String>['reason', 'service'], fallback: 'Visit reason unavailable')),
                                      ],
                                    ),
                                  ),
                                  StatusBadge(readString(item, const <String>['status'], fallback: 'Pending')),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: <Widget>[
                                  Chip(label: Text(readString(item, const <String>['time', 'startsAt'], fallback: 'Unscheduled'))),
                                  Chip(label: Text(readString(item, const <String>['visitType', 'appointmentType'], fallback: 'Visit'))),
                                  Chip(label: Text(readString(item, const <String>['paymentState'], fallback: 'Payment status'))),
                                ],
                              ),
                              const SizedBox(height: 12),
                              Row(
                                children: <Widget>[
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () {
                                        final String id = readString(item, const <String>['id'], fallback: '');
                                        if (id.isNotEmpty && id != '—') context.go('/appointments/$id');
                                      },
                                      child: const Text('Open detail'),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      )),
              ],
            ),
          ),
        );
      },
    );
  }
}
