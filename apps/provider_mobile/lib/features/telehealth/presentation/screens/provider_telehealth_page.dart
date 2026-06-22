import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderTelehealthPage extends StatefulWidget {
  const ProviderTelehealthPage({super.key});

  @override
  State<ProviderTelehealthPage> createState() => _ProviderTelehealthPageState();
}

class _ProviderTelehealthPageState extends State<ProviderTelehealthPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.telehealthSessions();
  }

  void _refresh() {
    setState(() => _future = ProviderSession.instance.api.telehealthSessions());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));
        final List<Map<String, dynamic>> items = pickList(snapshot.data, const <String>['items', 'sessions']);
        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                const ProviderHeroCard(
                  title: 'Telehealth sessions',
                  subtitle: 'Prepared, live, and ended sessions accessible from a provider-first mobile workspace.',
                  badge: 'Virtual care',
                ),
                const SizedBox(height: 20),
                if (items.isEmpty)
                  const EmptyStateCard(title: 'No telehealth sessions', subtitle: 'Prepared or active sessions will appear here.', icon: Icons.video_camera_back_outlined)
                else
                  ...items.map((item) {
                    final String sessionId = readString(item, const <String>['id'], fallback: '');
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(24),
                        onTap: sessionId.isEmpty ? null : () => context.go('/telehealth/$sessionId'),
                        child: ProviderCard(
                          child: Row(
                            children: <Widget>[
                              const CircleAvatar(child: Icon(Icons.video_camera_front_rounded)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(item, const <String>['patientName', 'subjectLabel']), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 4),
                                    Text(readString(item, const <String>['service', 'reason'], fallback: 'Telehealth session')),
                                    const SizedBox(height: 4),
                                    Text(formatDateTimeLabel(readString(item, const <String>['scheduledAt'], fallback: ''))),
                                  ],
                                ),
                              ),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.end,
                                children: <Widget>[
                                  StatusBadge(readString(item, const <String>['status'], fallback: 'Ready')),
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
  }
}
