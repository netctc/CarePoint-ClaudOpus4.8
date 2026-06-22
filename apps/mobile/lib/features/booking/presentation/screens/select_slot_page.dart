import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class SelectSlotPage extends StatefulWidget {
  const SelectSlotPage({super.key});

  @override
  State<SelectSlotPage> createState() => _SelectSlotPageState();
}

class _SelectSlotPageState extends State<SelectSlotPage> {
  late Future<Map<String, dynamic>> _future;
  Map<String, dynamic>? _selectedSlot;
  String? _error;
  bool _submitting = false;
  bool _extendingHold = false;

  @override
  void initState() {
    super.initState();
    _future = _loadSlots();
  }

  bool get _isOnlineBooking {
    final BookingDraft draft = BookingDraft.instance;
    final String mode = draft.serviceMode.toLowerCase();
    final String type = draft.appointmentType.toLowerCase();
    final String location = draft.location.toLowerCase();
    return mode == 'online' || type.contains('online') || type.contains('tele') || location.contains('virtual') || location.contains('online');
  }

  Future<Map<String, dynamic>> _loadSlots() {
    final BookingDraft draft = BookingDraft.instance;
    if (draft.providerId == null) {
      return Future<Map<String, dynamic>>.value(<String, dynamic>{'items': <dynamic>[]});
    }
    return AppSession.instance.availableSlots(
      providerId: draft.providerId!,
      service: draft.service,
      location: _isOnlineBooking ? null : draft.location,
      days: 21,
    );
  }

  Future<void> _extendHold() async {
    final BookingDraft draft = BookingDraft.instance;
    if (draft.slotHoldId == null || draft.slotHoldId!.isEmpty) return;
    setState(() {
      _extendingHold = true;
      _error = null;
    });
    try {
      final Map<String, dynamic> response = await AppSession.instance.extendSlotHold(draft.slotHoldId!, extendMinutes: 5);
      final Map<String, dynamic> hold = (response['hold'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      draft.slotHoldExpiresAt = hold['expiresAt'] == null ? draft.slotHoldExpiresAt : DateTime.tryParse(hold['expiresAt'].toString());
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _extendingHold = false);
    }
  }

  Future<void> _continue() async {
    final BookingDraft draft = BookingDraft.instance;
    if (_selectedSlot == null || draft.providerId == null) {
      setState(() => _error = 'Select a slot before continuing.');
      return;
    }

    final DateTime? slotStartsAt = DateTime.tryParse(_selectedSlot!['startsAt']?.toString() ?? '');
    final DateTime? slotEndsAt = DateTime.tryParse(_selectedSlot!['endsAt']?.toString() ?? '');
    if (slotStartsAt == null) {
      setState(() => _error = 'Selected slot is missing a valid start time. Refresh availability and select another slot.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      final DateTime startsAt = slotStartsAt;
      final DateTime endsAt = slotEndsAt ?? startsAt.add(const Duration(minutes: 30));
      final String slotService = _selectedSlot!['service']?.toString().trim().isNotEmpty == true ? _selectedSlot!['service'].toString() : draft.service;
      final String slotLocation = _selectedSlot!['location']?.toString().trim().isNotEmpty == true ? _selectedSlot!['location'].toString() : draft.location;
      if (draft.slotHoldId != null && draft.slotHoldId!.isNotEmpty) {
        try {
          await AppSession.instance.releaseSlotHold(draft.slotHoldId!);
        } catch (_) {}
      }
      final Map<String, dynamic> response = await AppSession.instance.createSlotHold(
        providerId: draft.providerId!,
        service: slotService,
        location: slotLocation,
        startsAt: startsAt,
        endsAt: endsAt,
      );
      final Map<String, dynamic> hold = (response['hold'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      final Map<String, dynamic> policyResponse = await AppSession.instance.bookingPolicyPreview(
        providerId: draft.providerId!,
        service: slotService,
        location: slotLocation,
        startsAt: startsAt,
        endsAt: endsAt,
      );
      draft.service = slotService;
      draft.location = slotLocation;
      draft.appointmentType = slotLocation.toLowerCase().contains('virtual') || slotLocation.toLowerCase().contains('online') || _isOnlineBooking ? 'ONLINE_MEETING' : 'IN_PERSON_VISIT';
      draft.startsAt = startsAt;
      draft.endsAt = endsAt;
      draft.slotHoldId = hold['id']?.toString();
      draft.slotHoldExpiresAt = hold['expiresAt'] == null ? null : DateTime.tryParse(hold['expiresAt'].toString());
      draft.bookingPolicy = (policyResponse['policy'] as Map?)?.cast<String, dynamic>();
      draft.policyAccepted = false;
      draft.authorizationConfirmed = false;
      if (!mounted) return;
      context.go('/booking/intake');
    } catch (error) {
      setState(() => _error = error.toString());
      setState(() => _future = _loadSlots());
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;

    return PatientScaffold(
      showBack: true,
      title: 'Select slot',
      subtitle: 'Choose from published future availability for the selected appointment type.',
      bottomAction: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: AppPrimaryButton(
          label: _submitting ? 'Placing hold…' : 'Continue to intake',
          icon: Icons.arrow_forward,
          onPressed: _submitting ? null : _continue,
        ),
      ),
      child: FutureBuilder<Map<String, dynamic>>(
        future: _future,
        builder: (BuildContext context, AsyncSnapshot<Map<String, dynamic>> snapshot) {
          final List<dynamic> items = snapshot.data?['items'] as List<dynamic>? ?? <dynamic>[];
          final DateTime now = DateTime.now();
          final List<Map<String, dynamic>> slots = items
              .whereType<Map>()
              .map((Map<dynamic, dynamic> item) => Map<String, dynamic>.from(item))
              .where((Map<String, dynamic> item) {
                final DateTime? startsAt = DateTime.tryParse(item['startsAt']?.toString() ?? '');
                final int availableCount = (item['availableCount'] as num? ?? 0).toInt();
                final String status = item['status']?.toString().toUpperCase() ?? item['statusLabel']?.toString().toUpperCase() ?? '';
                return startsAt != null && startsAt.isAfter(now) && availableCount > 0 && status != 'CANCELLED';
              })
              .toList()
            ..sort((Map<String, dynamic> a, Map<String, dynamic> b) => (DateTime.tryParse(a['startsAt']?.toString() ?? '') ?? now).compareTo(DateTime.tryParse(b['startsAt']?.toString() ?? '') ?? now));

          return ListView(
            padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
            children: <Widget>[
              PatientHeroCard(
                badge: _isOnlineBooking ? 'Online appointment' : draft.location,
                title: draft.providerName ?? 'Selected provider',
                subtitle: '${draft.specialty ?? ''} • ${draft.service}',
              ),
              const SizedBox(height: 18),
              if (_isOnlineBooking)
                const Padding(
                  padding: EdgeInsets.only(bottom: 14),
                  child: PatientTintedCard(
                    tint: Color(0xFFF5F9FF),
                    child: Text('Online appointments do not require a city or facility filter. All published virtual slots are shown here.'),
                  ),
                ),
              if (draft.slotHoldExpiresAt != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: PatientCard(
                    child: Row(
                      children: <Widget>[
                        const Icon(Icons.timer_outlined, color: AppColors.primaryDark),
                        const SizedBox(width: 12),
                        Expanded(child: Text('Current hold expires at ${DateFormat('h:mm a').format(draft.slotHoldExpiresAt!.toLocal())}.', style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary))),
                        TextButton(onPressed: _extendingHold ? null : _extendHold, child: Text(_extendingHold ? 'Extending…' : 'Extend 5m')),
                      ],
                    ),
                  ),
                ),
              if (snapshot.connectionState != ConnectionState.done)
                const Padding(
                  padding: EdgeInsets.all(30),
                  child: Center(child: CircularProgressIndicator()),
                ),
              if (snapshot.hasError)
                PatientEmptyState(title: 'Could not load slots', body: snapshot.error.toString(), icon: Icons.cloud_off_outlined, action: FilledButton.tonal(onPressed: () => setState(() => _future = _loadSlots()), child: const Text('Retry'))),
              if (snapshot.connectionState == ConnectionState.done && slots.isEmpty)
                PatientEmptyState(
                  title: 'No published future slots are available',
                  body: _isOnlineBooking ? 'No virtual slots are published for this service yet. Refresh availability or choose a different service.' : 'Refresh availability or change the selected facility or service to see another slot set.',
                  icon: Icons.event_busy_outlined,
                  action: FilledButton.tonalIcon(onPressed: () => setState(() => _future = _loadSlots()), icon: const Icon(Icons.refresh), label: const Text('Refresh availability')),
                ),
              ...slots.map((Map<String, dynamic> slot) {
                final DateTime startsAt = DateTime.tryParse(slot['startsAt']?.toString() ?? '') ?? DateTime.now();
                final String selectedId = _selectedSlot?['id']?.toString() ?? _selectedSlot?['startsAt']?.toString() ?? '';
                final String slotId = slot['id']?.toString() ?? slot['startsAt']?.toString() ?? '';
                final bool selected = selectedId == slotId;
                final int holdCount = (slot['activeHoldCount'] as num? ?? 0).toInt();
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(24),
                    onTap: () => setState(() => _selectedSlot = slot),
                    child: PatientCard(
                      child: Row(
                        children: <Widget>[
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(color: selected ? AppColors.primarySoft : AppColors.surfaceTint, borderRadius: BorderRadius.circular(14)),
                            child: Icon(selected ? Icons.check_circle : Icons.schedule, color: selected ? AppColors.primaryDark : AppColors.textSecondary),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                Text(_formatSlot(startsAt), style: Theme.of(context).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700)),
                                const SizedBox(height: 4),
                                Text('${slot['service']} • ${slot['location']}', style: Theme.of(context).textTheme.bodyMedium),
                                if (holdCount > 0) ...<Widget>[
                                  const SizedBox(height: 6),
                                  PatientTag(label: '$holdCount active hold${holdCount == 1 ? '' : 's'}', icon: Icons.lock_clock_outlined, backgroundColor: AppColors.warningSoft, foregroundColor: const Color(0xFFB45309)),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
              if (_error != null) ...<Widget>[
                const SizedBox(height: 12),
                Text(_error!, style: const TextStyle(color: AppColors.danger, fontWeight: FontWeight.w600)),
              ],
            ],
          );
        },
      ),
    );
  }
}

String _formatSlot(DateTime date) {
  return DateFormat('EEE, d MMM • h:mm a').format(date.toLocal());
}
