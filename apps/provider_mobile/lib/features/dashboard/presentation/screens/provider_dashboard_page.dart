import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderDashboardPage extends StatefulWidget {
  const ProviderDashboardPage({super.key});

  @override
  State<ProviderDashboardPage> createState() => _ProviderDashboardPageState();
}

class _ProviderDashboardPageState extends State<ProviderDashboardPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'dashboard': await api.dashboard(),
      'alerts': await api.alerts(),
      'telehealth': await api.telehealthSessions(),
    };
  }

  void _refresh() {
    setState(() {
      _future = _load();
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

        final Map<String, dynamic> data = snapshot.data ?? <String, dynamic>{};
        final Map<String, dynamic> dashboard = pickMap(data['dashboard'], const <String>['dashboard', 'data']);
        final Map<String, dynamic> kpis = pickMap(dashboard, const <String>['kpis', 'summary']);
        final List<Map<String, dynamic>> queue = pickList(dashboard, const <String>['queue', 'appointments', 'items']);
        final List<Map<String, dynamic>> alerts = pickList(data['alerts'], const <String>['alerts', 'items']);
        final List<Map<String, dynamic>> sessions = pickList(data['telehealth'], const <String>['items', 'sessions']);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Welcome back, ${ProviderSession.instance.displayName.split(' ').first}',
                  subtitle: 'Monitor today\'s queue, secure messages, telehealth readiness, and operational alerts from a dedicated provider workspace.',
                  badge: ProviderSession.instance.roleLabel,
                  trailing: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      FilledButton.icon(onPressed: () => context.go('/queue'), icon: const Icon(Icons.event_note_rounded), label: const Text('Queue')),
                      OutlinedButton.icon(onPressed: () => context.go('/messages'), icon: const Icon(Icons.chat_bubble_outline_rounded), label: const Text('Messages')),
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
                    MetricCard(label: 'Today\'s appointments', value: '${readInt(kpis, const <String>['todaysAppointments', 'appointmentsToday'])}'),
                    MetricCard(label: 'Waiting patients', value: '${readInt(kpis, const <String>['waitingPatients', 'waiting'])}', variant: MetricVariant.warning),
                    MetricCard(label: 'Unread messages', value: '${readInt(kpis, const <String>['unreadMessages', 'messagesUnread'])}', variant: MetricVariant.primary),
                    MetricCard(label: 'Open alerts', value: '${readInt(kpis, const <String>['openAlerts', 'alertsOpen'])}', variant: MetricVariant.danger),
                  ],
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Quick actions'),
                const SizedBox(height: 12),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: const <Widget>[
                    _QuickActionChip(label: 'Calendar', icon: Icons.calendar_month_rounded, route: '/calendar'),
                    _QuickActionChip(label: 'Alerts', icon: Icons.warning_amber_rounded, route: '/alerts'),
                    _QuickActionChip(label: 'Telehealth', icon: Icons.video_camera_front_rounded, route: '/telehealth'),
                    _QuickActionChip(label: 'Records', icon: Icons.folder_shared_rounded, route: '/records'),
                    _QuickActionChip(label: 'Labs', icon: Icons.biotech_rounded, route: '/labs'),
                    _QuickActionChip(label: 'RPM', icon: Icons.monitor_heart_rounded, route: '/rpm'),
                  ],
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Queue snapshot'),
                const SizedBox(height: 12),
                if (queue.isEmpty)
                  const EmptyStateCard(title: 'No queue items', subtitle: 'Today\'s provider queue will appear here when appointments are available.')
                else
                  ...queue.take(4).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(item, const <String>['patientName', 'patient', 'subjectLabel']), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(item, const <String>['status'], fallback: 'Pending')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(readString(item, const <String>['reason', 'service']), style: Theme.of(context).textTheme.bodyMedium),
                              const SizedBox(height: 12),
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(item, const <String>['time', 'startsAt'], fallback: 'Schedule unavailable'))),
                                  TextButton(
                                    onPressed: () {
                                      final String appointmentId = readString(item, const <String>['id'], fallback: '');
                                      if (appointmentId.isNotEmpty && appointmentId != '—') {
                                        context.go('/appointments/$appointmentId');
                                      }
                                    },
                                    child: const Text('View'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Open alerts'),
                const SizedBox(height: 12),
                if (alerts.isEmpty)
                  const EmptyStateCard(title: 'No active alerts', subtitle: 'Operational and clinical alerts will appear here when action is required.', icon: Icons.verified_rounded)
                else
                  ...alerts.take(3).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Row(
                                children: <Widget>[
                                  Expanded(child: Text(readString(item, const <String>['title', 'name']), style: Theme.of(context).textTheme.titleMedium)),
                                  StatusBadge(readString(item, const <String>['severity', 'status'], fallback: 'Open')),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Text(readString(item, const <String>['detail', 'description', 'summary']), style: Theme.of(context).textTheme.bodyMedium),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Telehealth sessions'),
                const SizedBox(height: 12),
                if (sessions.isEmpty)
                  const EmptyStateCard(title: 'No telehealth sessions', subtitle: 'Prepared or active video sessions will appear here.', icon: Icons.video_call_rounded)
                else
                  ...sessions.take(3).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            children: <Widget>[
                              const CircleAvatar(child: Icon(Icons.video_camera_front_rounded)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(item, const <String>['patientName', 'patient', 'subjectLabel']), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 4),
                                    Text(readString(item, const <String>['service', 'reason'], fallback: 'Telehealth session'), style: Theme.of(context).textTheme.bodyMedium),
                                  ],
                                ),
                              ),
                              StatusBadge(readString(item, const <String>['status'], fallback: 'Ready')),
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

class _QuickActionChip extends StatelessWidget {
  const _QuickActionChip({required this.label, required this.icon, required this.route});

  final String label;
  final IconData icon;
  final String route;

  @override
  Widget build(BuildContext context) {
    return ActionChip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      onPressed: () => context.go(route),
    );
  }
}
