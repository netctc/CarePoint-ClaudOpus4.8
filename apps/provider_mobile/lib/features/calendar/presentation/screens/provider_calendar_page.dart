import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderCalendarPage extends StatefulWidget {
  const ProviderCalendarPage({super.key});

  @override
  State<ProviderCalendarPage> createState() => _ProviderCalendarPageState();
}

class _ProviderCalendarPageState extends State<ProviderCalendarPage> {
  late Future<Map<String, dynamic>> _future;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.calendarOverview();
  }

  void _refresh() {
    setState(() => _future = ProviderSession.instance.api.calendarOverview());
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));

        final Map<String, dynamic> data = snapshot.data ?? <String, dynamic>{};
        final Map<String, dynamic> summary = pickMap(data, const <String>['summary', 'overview']);
        final List<Map<String, dynamic>> slots = pickList(data, const <String>['publishedSlots', 'slots', 'items']);
        final List<Map<String, dynamic>> templates = pickList(data, const <String>['templates', 'items']);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: 'Calendar overview',
                  subtitle: 'Published slots, availability templates, and booking operations for the provider schedule.',
                  badge: 'Scheduling',
                  trailing: FilledButton.icon(
                    onPressed: () => context.go('/calendar/manage'),
                    icon: const Icon(Icons.edit_calendar_outlined),
                    label: const Text('Manage schedule'),
                  ),
                ),
                const SizedBox(height: 20),
                GridView.count(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  crossAxisCount: 2,
                  mainAxisSpacing: 12,
                  crossAxisSpacing: 12,
                  childAspectRatio: 1.35,
                  children: <Widget>[
                    MetricCard(label: 'Published slots', value: '${readInt(summary, const <String>['publishedSlots', 'slotCount'])}'),
                    MetricCard(label: 'Templates', value: '${templates.length}'),
                    MetricCard(label: 'Booked appointments', value: '${readInt(summary, const <String>['bookedAppointments', 'bookedCount'])}', variant: MetricVariant.success),
                    MetricCard(label: 'Holds / controls', value: '${readInt(summary, const <String>['holds', 'holdCount'])}', variant: MetricVariant.warning),
                  ],
                ),
                const SizedBox(height: 20),
                const SectionTitle(title: 'Published slots'),
                const SizedBox(height: 12),
                if (slots.isEmpty)
                  const EmptyStateCard(title: 'No published slots', subtitle: 'Published calendar capacity will appear here.')
                else
                  ...slots.take(8).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            children: <Widget>[
                              const CircleAvatar(child: Icon(Icons.schedule_rounded)),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Text(readString(item, const <String>['service', 'title'], fallback: 'Slot'), style: Theme.of(context).textTheme.titleMedium),
                                    const SizedBox(height: 4),
                                    Text(readString(item, const <String>['startsAt', 'time'], fallback: 'Unscheduled'), style: Theme.of(context).textTheme.bodyMedium),
                                  ],
                                ),
                              ),
                              StatusBadge(readString(item, const <String>['status'], fallback: 'Published')),
                            ],
                          ),
                        ),
                      )),
                const SizedBox(height: 8),
                const SectionTitle(title: 'Templates'),
                const SizedBox(height: 12),
                if (templates.isEmpty)
                  const EmptyStateCard(title: 'No slot templates', subtitle: 'Saved calendar templates will appear here.', icon: Icons.view_week_rounded)
                else
                  ...templates.take(4).map((item) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              Text(readString(item, const <String>['templateName', 'name'], fallback: 'Template'), style: Theme.of(context).textTheme.titleMedium),
                              const SizedBox(height: 6),
                              Text('${readString(item, const <String>['service'], fallback: 'Service')} • ${readString(item, const <String>['location'], fallback: 'Location')}'),
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
