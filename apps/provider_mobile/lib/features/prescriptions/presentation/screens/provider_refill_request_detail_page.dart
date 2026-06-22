import 'package:flutter/material.dart';

import '../../../../core/state/offline_action_queue.dart';
import '../../../../core/state/provider_session.dart';
import '../../../../core/utils/json_utils.dart';
import '../../../../core/widgets/provider_ui.dart';

class ProviderRefillRequestDetailPage extends StatefulWidget {
  const ProviderRefillRequestDetailPage({required this.requestId, super.key});

  final String requestId;

  @override
  State<ProviderRefillRequestDetailPage> createState() => _ProviderRefillRequestDetailPageState();
}

class _ProviderRefillRequestDetailPageState extends State<ProviderRefillRequestDetailPage> {
  static const List<String> _assignedRoleOptions = <String>['PROVIDER', 'PHARMACIST', 'NURSE'];
  static const List<String> _queueOptions = <String>['PROVIDER_REVIEW', 'PHARMACY_NETWORK', 'MANUAL_REVIEW', 'READY_FOR_FULFILLMENT'];
  static const List<String> _severityOptions = <String>['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

  late Future<Map<String, dynamic>> _future;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _future = _load();
  }

  Future<Map<String, dynamic>> _load() async {
    final api = ProviderSession.instance.api;
    return <String, dynamic>{
      'requests': await api.refillRequests(),
      'history': await api.refillRequestHistory(widget.requestId),
      'options': await api.refillQueueOptions(),
    };
  }

  void _refresh() => setState(() => _future = _load());

  Future<void> _review(String action) async {
    final TextEditingController noteController = TextEditingController(
      text: action == 'APPROVE'
          ? 'Approved from provider mobile.'
          : action == 'ROUTE_TO_PHARMACY'
              ? 'Routed to pharmacy from provider mobile.'
              : 'Reviewed from provider mobile.',
    );
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(action.replaceAll('_', ' ')),
        content: TextField(
          controller: noteController,
          decoration: const InputDecoration(labelText: 'Note'),
          maxLines: 4,
        ),
        actions: <Widget>[
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Confirm')),
        ],
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    final Map<String, dynamic> payload = <String, dynamic>{
      'action': action,
      'note': noteController.text.trim(),
    };

    try {
      await ProviderSession.instance.api.reviewRefillRequest(widget.requestId, payload);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Refill request ${action.toLowerCase().replaceAll('_', ' ')}.')));
      _refresh();
    } catch (error) {
      if (!context.mounted) return;
      if (OfflineActionQueue.looksRetryableMutationError(error)) {
        await OfflineActionQueue.instance.enqueue(type: 'refill_review', title: 'Refill review action', resourceId: widget.requestId, payload: payload);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connection issue detected. The refill review was added to the offline queue.')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _assign(Map<String, dynamic> request, List<String> roleOptions, List<String> queueOptions) async {
    String assignedRole = roleOptions.contains(readString(request, const <String>['assignedRole'], fallback: '')) ? readString(request, const <String>['assignedRole'], fallback: '') : roleOptions.first;
    String queue = queueOptions.contains(readString(request, const <String>['queue'], fallback: '')) ? readString(request, const <String>['queue'], fallback: '') : queueOptions.first;
    final TextEditingController ownerController = TextEditingController(text: readString(request, const <String>['assignedOwnerName'], fallback: '').replaceAll('—', ''));
    final TextEditingController noteController = TextEditingController(text: 'Assigned from provider mobile.');
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocalState) => AlertDialog(
          title: const Text('Assign refill request'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                DropdownButtonFormField<String>(
                  initialValue: assignedRole,
                  decoration: const InputDecoration(labelText: 'Assigned role'),
                  items: roleOptions.map((value) => DropdownMenuItem<String>(value: value, child: Text(value))).toList(),
                  onChanged: (value) {
                    if (value != null) setLocalState(() => assignedRole = value);
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: queue,
                  decoration: const InputDecoration(labelText: 'Queue'),
                  items: queueOptions.map((value) => DropdownMenuItem<String>(value: value, child: Text(value))).toList(),
                  onChanged: (value) {
                    if (value != null) setLocalState(() => queue = value);
                  },
                ),
                const SizedBox(height: 12),
                TextField(controller: ownerController, decoration: const InputDecoration(labelText: 'Owner name')),
                const SizedBox(height: 12),
                TextField(controller: noteController, decoration: const InputDecoration(labelText: 'Note'), maxLines: 3),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Assign')),
          ],
        ),
      ),
    );
    if (confirmed != true) return;

    setState(() => _busy = true);
    final Map<String, dynamic> payload = <String, dynamic>{
      'assignedRole': assignedRole,
      'queue': queue,
      if (ownerController.text.trim().isNotEmpty) 'ownerName': ownerController.text.trim(),
      if (noteController.text.trim().isNotEmpty) 'note': noteController.text.trim(),
    };

    try {
      await ProviderSession.instance.api.assignRefillRequest(widget.requestId, payload);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Refill request reassigned.')));
      _refresh();
    } catch (error) {
      if (!context.mounted) return;
      if (OfflineActionQueue.looksRetryableMutationError(error)) {
        await OfflineActionQueue.instance.enqueue(type: 'refill_assign', title: 'Refill assignment update', resourceId: widget.requestId, payload: payload);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connection issue detected. The refill assignment was added to the offline queue.')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _escalate(List<String> severityOptions) async {
    String severity = severityOptions.first;
    String ownerRole = 'PROVIDER';
    final TextEditingController reasonController = TextEditingController();
    final TextEditingController noteController = TextEditingController(text: 'Escalated from provider mobile.');
    final bool? confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setLocalState) => AlertDialog(
          title: const Text('Escalate refill request'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                DropdownButtonFormField<String>(
                  initialValue: severity,
                  decoration: const InputDecoration(labelText: 'Severity'),
                  items: severityOptions.map((value) => DropdownMenuItem<String>(value: value, child: Text(value))).toList(),
                  onChanged: (value) {
                    if (value != null) setLocalState(() => severity = value);
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  initialValue: ownerRole,
                  decoration: const InputDecoration(labelText: 'Owner role'),
                  items: _assignedRoleOptions.map((value) => DropdownMenuItem<String>(value: value, child: Text(value))).toList(),
                  onChanged: (value) {
                    if (value != null) setLocalState(() => ownerRole = value);
                  },
                ),
                const SizedBox(height: 12),
                TextField(controller: reasonController, decoration: const InputDecoration(labelText: 'Reason'), maxLines: 3),
                const SizedBox(height: 12),
                TextField(controller: noteController, decoration: const InputDecoration(labelText: 'Note'), maxLines: 3),
              ],
            ),
          ),
          actions: <Widget>[
            TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
            FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Escalate')),
          ],
        ),
      ),
    );
    if (confirmed != true) return;

    if (reasonController.text.trim().length < 4) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Enter an escalation reason with at least 4 characters.')));
      return;
    }

    setState(() => _busy = true);
    final Map<String, dynamic> payload = <String, dynamic>{
      'severity': severity,
      'ownerRole': ownerRole,
      'reason': reasonController.text.trim(),
      if (noteController.text.trim().isNotEmpty) 'note': noteController.text.trim(),
    };

    try {
      await ProviderSession.instance.api.escalateRefillRequest(widget.requestId, payload);
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Refill request escalated.')));
      _refresh();
    } catch (error) {
      if (!context.mounted) return;
      if (OfflineActionQueue.looksRetryableMutationError(error)) {
        await OfflineActionQueue.instance.enqueue(type: 'refill_escalate', title: 'Refill escalation', resourceId: widget.requestId, payload: payload);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Connection issue detected. The refill escalation was added to the offline queue.')));
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(error.toString())));
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Map<String, dynamic>>(
      future: _future,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) return const ProviderPage(child: LoadingBlock());
        if (snapshot.hasError) return ProviderPage(child: ErrorStateCard(message: snapshot.error.toString(), onRetry: _refresh));

        final List<Map<String, dynamic>> requests = pickList(snapshot.data?['requests'], const <String>['items', 'requests', 'refillRequests']);
        final Map<String, dynamic> request = requests.cast<Map<String, dynamic>>().firstWhere(
              (item) => readString(item, const <String>['id'], fallback: '') == widget.requestId,
              orElse: () => <String, dynamic>{},
            );
        final List<Map<String, dynamic>> history = pickList(snapshot.data?['history'], const <String>['items', 'history', 'timeline']);
        final Map<String, dynamic> options = pickMap(snapshot.data?['options'], const <String>['options', 'data']);
        final List<String> roleOptions = _readStringList(options['assignedRoles'], fallback: _assignedRoleOptions);
        final List<String> queueOptions = _readStringList(options['queues'], fallback: _queueOptions);
        final List<String> severityOptions = _readStringList(options['escalationSeverities'], fallback: _severityOptions);

        if (request.isEmpty) {
          return ProviderPage(
            child: ErrorStateCard(
              message: 'Refill request ${widget.requestId} was not found in the current provider queue.',
              onRetry: _refresh,
            ),
          );
        }

        return SafeArea(
          top: false,
          child: RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
              children: <Widget>[
                ProviderHeroCard(
                  title: readString(request, const <String>['patientName', 'drug'], fallback: 'Refill request'),
                  subtitle: readString(request, const <String>['drug', 'prescriptionId'], fallback: 'Medication refill workflow'),
                  badge: readString(request, const <String>['status'], fallback: 'Open'),
                  trailing: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      FilledButton.icon(
                        onPressed: _busy ? null : () => _review('APPROVE'),
                        icon: const Icon(Icons.task_alt_rounded),
                        label: const Text('Approve'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _busy ? null : () => _review('ROUTE_TO_PHARMACY'),
                        icon: const Icon(Icons.local_shipping_outlined),
                        label: const Text('Route'),
                      ),
                      OutlinedButton.icon(
                        onPressed: _busy ? null : () => _review('REJECT'),
                        icon: const Icon(Icons.block_rounded),
                        label: const Text('Reject'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
                ProviderCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      _InfoRow(label: 'Prescription', value: readString(request, const <String>['prescriptionId'], fallback: '—')),
                      _InfoRow(label: 'Queue', value: readString(request, const <String>['queue', 'pharmacyRoutingState'], fallback: '—')),
                      _InfoRow(label: 'Assigned role', value: readString(request, const <String>['assignedRole'], fallback: '—')),
                      _InfoRow(label: 'Owner', value: readString(request, const <String>['assignedOwnerName'], fallback: '—')),
                      _InfoRow(label: 'Aging band', value: readString(request, const <String>['agingBand'], fallback: '—')),
                      _InfoRow(label: 'Fulfillment', value: readString(request, const <String>['fulfillmentStatus'], fallback: '—')),
                      _InfoRow(label: 'Escalation', value: readBool(request, const <String>['escalated']) ? readString(request, const <String>['escalationSeverity'], fallback: 'Escalated') : 'No'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                ProviderCard(
                  child: Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: <Widget>[
                      FilledButton.icon(
                        onPressed: _busy ? null : () => _assign(request, roleOptions, queueOptions),
                        icon: const Icon(Icons.assignment_ind_outlined),
                        label: const Text('Assign'),
                      ),
                      FilledButton.tonalIcon(
                        onPressed: _busy ? null : () => _escalate(severityOptions),
                        icon: const Icon(Icons.priority_high_rounded),
                        label: const Text('Escalate'),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                const SectionTitle(title: 'Operational timeline'),
                const SizedBox(height: 12),
                if (history.isEmpty)
                  const EmptyStateCard(
                    title: 'No timeline available',
                    subtitle: 'Ownership changes and review actions will appear here when history is returned by the refill API.',
                    icon: Icons.history_rounded,
                  )
                else
                  ...history.map((event) => Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: ProviderCard(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: <Widget>[
                              const Padding(
                                padding: EdgeInsets.only(top: 3),
                                child: Icon(Icons.history_toggle_off_rounded),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: <Widget>[
                                    Row(
                                      children: <Widget>[
                                        Expanded(child: Text(readString(event, const <String>['label', 'status'], fallback: 'Refill event'), style: Theme.of(context).textTheme.titleMedium)),
                                        StatusBadge(readString(event, const <String>['status'], fallback: 'Logged')),
                                      ],
                                    ),
                                    const SizedBox(height: 6),
                                    Text(formatDateTimeLabel(readString(event, const <String>['at', 'createdAt', 'updatedAt'], fallback: ''))),
                                    const SizedBox(height: 6),
                                    Text(readString(event, const <String>['note', 'details', 'ownerName'], fallback: 'No note captured.')),
                                  ],
                                ),
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

  List<String> _readStringList(dynamic source, {required List<String> fallback}) {
    if (source is! List) return fallback;
    final List<String> values = source.map((item) => item.toString().trim()).where((item) => item.isNotEmpty).toList();
    return values.isEmpty ? fallback : values;
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
