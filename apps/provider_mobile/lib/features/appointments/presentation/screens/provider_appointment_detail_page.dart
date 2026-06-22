import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/clinical_routes.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderAppointmentDetailPage extends StatefulWidget {
  const ProviderAppointmentDetailPage({required this.appointmentId, super.key});

  final String appointmentId;

  @override
  State<ProviderAppointmentDetailPage> createState() => _ProviderAppointmentDetailPageState();
}

class _ProviderAppointmentDetailPageState extends State<ProviderAppointmentDetailPage> {
  late Future<Map<String, dynamic>> _future;
  bool _submitting = false;

  @override
  void initState() {
    super.initState();
    _future = ProviderSession.instance.api.appointment(widget.appointmentId);
  }

  void _refresh() {
    setState(() {
      _future = ProviderSession.instance.api.appointment(widget.appointmentId);
    });
  }

  Future<void> _runAction(Future<void> Function() action, String successMessage) async {
    setState(() => _submitting = true);
    try {
      await action();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(successMessage)));
      _refresh();
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
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
        final Map<String, dynamic> item = pickMap(snapshot.data, const <String>['appointment', 'item', 'data']);
        final String status = readString(item, const <String>['status'], fallback: 'Scheduled');
        final String patientId = readString(item, const <String>['patientId'], fallback: '');
        final String chartRoute = buildChartRoute(item);
        final String encounterRoute = buildEncounterRoute(item);
        final String orderRoute = buildOrderComposerRoute(item);
        final String prescriptionRoute = buildPrescriptionComposerRoute(item);

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(item, const <String>['patientName', 'subjectLabel']),
                  subtitle: readString(item, const <String>['reason', 'service'], fallback: 'Appointment detail'),
                  badge: status,
                  trailing: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      FilledButton.icon(
                        onPressed: patientId.isEmpty || _submitting ? null : () => context.go(chartRoute),
                        icon: const Icon(Icons.folder_shared_rounded),
                        label: const Text('Open chart'),
                      ),
                      OutlinedButton.icon(
                        onPressed: patientId.isEmpty || _submitting ? null : () => context.go(encounterRoute),
                        icon: const Icon(Icons.edit_note_rounded),
                        label: const Text('Encounter note'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _InfoRow(label: 'Appointment ID', value: readString(item, const <String>['id'])),
                      _InfoRow(label: 'Starts at', value: formatDateTimeLabel(readString(item, const <String>['startsAt', 'time'], fallback: ''))),
                      _InfoRow(label: 'Visit type', value: readString(item, const <String>['appointmentType', 'visitType'], fallback: '—')),
                      _InfoRow(label: 'Location', value: readString(item, const <String>['location'], fallback: '—')),
                      _InfoRow(label: 'Provider', value: readString(item, const <String>['providerName', 'provider'], fallback: '—')),
                      _InfoRow(label: 'Payment', value: readString(item, const <String>['paymentState'], fallback: '—')),
                      _InfoRow(label: 'Patient ID', value: patientId.isEmpty ? '—' : patientId),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionTitle(title: 'Clinical actions'),
                const SizedBox(height: 12),
                ProviderCard(
                  child: Column(
                    children: <Widget>[
                      _ActionTile(
                        icon: Icons.description_rounded,
                        title: 'Patient chart',
                        subtitle: 'Review recent records, access context, and family-subject visibility.',
                        onTap: patientId.isEmpty ? null : () => context.go(chartRoute),
                      ),
                      const Divider(height: 24),
                      _ActionTile(
                        icon: Icons.note_alt_rounded,
                        title: 'Encounter note',
                        subtitle: 'Validate documentation completeness and sign the SOAP note.',
                        onTap: patientId.isEmpty ? null : () => context.go(encounterRoute),
                      ),
                      const Divider(height: 24),
                      _ActionTile(
                        icon: Icons.science_rounded,
                        title: 'Create order',
                        subtitle: 'Capture labs, imaging, or referral requests from this encounter context.',
                        onTap: patientId.isEmpty ? null : () => context.go(orderRoute),
                      ),
                      const Divider(height: 24),
                      _ActionTile(
                        icon: Icons.medication_rounded,
                        title: 'Write prescription',
                        subtitle: 'Draft and sign a medication order with refill and pharmacy routing controls.',
                        onTap: patientId.isEmpty ? null : () => context.go(prescriptionRoute),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _submitting ? null : () => _runAction(() => ProviderSession.instance.api.confirmAppointment(widget.appointmentId), 'Appointment confirmed.'),
                        icon: const Icon(Icons.check_circle_outline_rounded),
                        label: const Text('Confirm'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: _submitting ? null : () => _runAction(() => ProviderSession.instance.api.cancelAppointment(widget.appointmentId), 'Appointment canceled.'),
                        icon: const Icon(Icons.cancel_outlined),
                        label: const Text('Cancel'),
                      ),
                    ),
                  ],
                ),
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
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 110, child: Text(label, style: Theme.of(context).textTheme.bodyMedium)),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyLarge)),
        ],
      ),
    );
  }
}

class _ActionTile extends StatelessWidget {
  const _ActionTile({required this.icon, required this.title, required this.subtitle, required this.onTap});

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback? onTap;

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
            const Icon(Icons.chevron_right_rounded),
          ],
        ),
      ),
    );
  }
}
