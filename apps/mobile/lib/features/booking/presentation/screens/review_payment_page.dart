import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';

class ReviewPaymentPage extends StatefulWidget {
  const ReviewPaymentPage({super.key});

  @override
  State<ReviewPaymentPage> createState() => _ReviewPaymentPageState();
}

class _ReviewPaymentPageState extends State<ReviewPaymentPage> {
  bool _loading = false;
  bool _extendingHold = false;
  String? _error;
  late Future<List<Map<String, dynamic>>> _walletMethodsFuture;

  @override
  void initState() {
    super.initState();
    _walletMethodsFuture = _loadWalletMethods();
  }

  Future<List<Map<String, dynamic>>> _loadWalletMethods() async {
    final Map<String, dynamic> result = await AppSession.instance.walletMethods();
    return ((result['items'] as List?) ?? <dynamic>[]).cast<Map<String, dynamic>>();
  }


  Future<void> _extendHold() async {
    final BookingDraft draft = BookingDraft.instance;
    final String? holdId = draft.slotHoldId;
    if (holdId == null || holdId.isEmpty) return;
    setState(() {
      _extendingHold = true;
      _error = null;
    });
    try {
      final Map<String, dynamic> response = await AppSession.instance.extendSlotHold(holdId);
      final Map<String, dynamic> hold = (response['hold'] as Map?)?.cast<String, dynamic>() ?? <String, dynamic>{};
      draft.slotHoldExpiresAt = hold['expiresAt'] == null ? draft.slotHoldExpiresAt : DateTime.tryParse(hold['expiresAt'].toString());
      if (mounted) setState(() {});
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _extendingHold = false);
      }
    }
  }

  Future<void> _confirm() async {
    final BookingDraft draft = BookingDraft.instance;
    final Map<String, dynamic> policy = draft.bookingPolicy ?? <String, dynamic>{};
    if (draft.providerId == null || draft.startsAt == null || draft.endsAt == null || draft.slotHoldId == null) {
      setState(() => _error = 'Missing provider selection or active slot hold. Return to slot selection and try again.');
      return;
    }

    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final String mergedNotes = <String>[
        if (draft.visitReason.isNotEmpty) 'Reason: ${draft.visitReason}',
        if (draft.symptoms.isNotEmpty) 'Symptoms: ${draft.symptoms}',
        if (draft.urgentSymptoms.isNotEmpty) 'Urgent symptom checklist: ${draft.urgentSymptoms.join(', ')}',
        if (draft.notes.isNotEmpty) 'Notes: ${draft.notes}',
        if (draft.insuranceNotes.isNotEmpty) 'Insurance: ${draft.insuranceNotes}',
      ].join('\n');

      final Map<String, dynamic> appointment = await AppSession.instance.createAppointmentFromHold(
        holdId: draft.slotHoldId!,
        providerId: draft.providerId!,
        service: draft.service,
        location: draft.location,
        appointmentType: draft.appointmentType,
        startsAt: draft.startsAt!,
        endsAt: draft.endsAt!,
        notes: mergedNotes,
        intakeCompleted: draft.intakeCompleted,
        insuranceUploaded: draft.insuranceUploaded,
        idUploaded: draft.idUploaded,
        authorizationConfirmed: draft.authorizationConfirmed,
        policyAccepted: draft.policyAccepted,
        paymentMethod: draft.paymentMethod,
        insuranceDocumentId: draft.insuranceDocumentId,
        idDocumentId: draft.identityDocumentId,
        authorizationDocumentId: draft.authorizationDocumentId,
      );
      final Map<String, dynamic> payment = await AppSession.instance.createPaymentIntent(
        appointmentId: appointment['id'].toString(),
        amountMinor: draft.amountMinor,
        currency: draft.currency,
        paymentMethod: draft.paymentMethod,
        walletMethodId: draft.walletMethodId,
        authorizationRequired: policy['authorizationRequired'] == true,
        authorizationConfirmed: draft.authorizationConfirmed,
        documentCount: [draft.insuranceDocumentId, draft.identityDocumentId, draft.authorizationDocumentId].where((String? value) => value != null && value.isNotEmpty).length,
      );
      final Map<String, dynamic> paymentRecord = (payment['payment'] as Map<String, dynamic>?) ?? <String, dynamic>{};
      final Map<String, dynamic> nextAction = (payment['nextAction'] as Map<String, dynamic>?) ?? <String, dynamic>{};
      final List<String> reviewReasons = (((paymentRecord['metadata'] as Map<String, dynamic>?)?['reviewReasonCodes'] as List?) ?? <dynamic>[]).map((dynamic item) => item.toString()).toList();
      draft.appointmentId = appointment['id'].toString();
      draft.paymentId = paymentRecord['id']?.toString();
      draft.paymentStatus = paymentRecord['status']?.toString();
      draft.paymentNextActionTitle = nextAction['title']?.toString();
      draft.paymentNextActionMessage = nextAction['message']?.toString();
      draft.paymentNextSteps = (((nextAction['steps'] as List?) ?? <dynamic>[]).map((dynamic item) => item.toString()).toList());
      draft.paymentReviewReasons = reviewReasons;
      draft.slotHoldId = null;
      draft.slotHoldExpiresAt = null;
      if (!mounted) return;
      context.go('/booking/confirmation');
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final BookingDraft draft = BookingDraft.instance;
    final Map<String, dynamic> policy = draft.bookingPolicy ?? <String, dynamic>{};
    final List<String> allowedMethods = ((policy['allowedPaymentMethods'] as List?) ?? <dynamic>['CARD', 'WALLET']).map((dynamic item) => item.toString()).toList();
    if (!allowedMethods.contains(draft.paymentMethod)) {
      draft.paymentMethod = allowedMethods.first;
    }
    final String slotLabel = draft.startsAt == null ? 'No slot selected' : DateFormat('EEE, d MMM · h:mm a').format(draft.startsAt!.toLocal());
    final int refundWindow = (policy['refundWindowHours'] as num?)?.toInt() ?? 12;
    final int cancellationWindow = (policy['cancellationWindowHours'] as num?)?.toInt() ?? refundWindow;

    return Scaffold(
      appBar: AppBar(title: const Text('Review & Payment'), centerTitle: true),
      body: SafeArea(
        child: FutureBuilder<List<Map<String, dynamic>>>(
          future: _walletMethodsFuture,
          builder: (BuildContext context, AsyncSnapshot<List<Map<String, dynamic>>> walletSnapshot) {
            final List<Map<String, dynamic>> walletMethods = walletSnapshot.data ?? <Map<String, dynamic>>[];
            if (draft.paymentMethod == 'WALLET' && walletMethods.isNotEmpty) {
              final bool hasSelectedMethod = walletMethods.any((Map<String, dynamic> item) => item['id']?.toString() == draft.walletMethodId);
              if (!hasSelectedMethod) {
                final Map<String, dynamic> defaultMethod = walletMethods.firstWhere(
                  (Map<String, dynamic> item) => item['isDefault'] == true,
                  orElse: () => walletMethods.first,
                );
                draft.walletMethodId = defaultMethod['id']?.toString();
              }
            }
            return ListView(
              padding: const EdgeInsets.all(24),
              children: <Widget>[
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(draft.providerName ?? 'Provider', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(draft.service),
                  const SizedBox(height: 4),
                  Text(draft.location),
                  const SizedBox(height: 4),
                  Text(slotLabel),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('Payment summary', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text('${draft.service} · ${draft.priceLabel}'),
                  const SizedBox(height: 4),
                  Text(draft.appointmentType == 'ONLINE_MEETING' ? 'Appointment type: Online Meeting' : 'Appointment type: In-Person Visit'),
                  const SizedBox(height: 4),
                  const Text('A payment intent will be created through the live API after the held slot is converted into a confirmed appointment request.'),
                  if (draft.slotHoldExpiresAt != null) ...<Widget>[
                    const SizedBox(height: 6),
                    Text('Current hold expires at ${DateFormat('h:mm a').format(draft.slotHoldExpiresAt!.toLocal())}.'),
                    const SizedBox(height: 8),
                    OutlinedButton.icon(
                      onPressed: _extendingHold ? null : _extendHold,
                      icon: _extendingHold ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2)) : const Icon(Icons.timer),
                      label: Text(_extendingHold ? 'Extending hold…' : 'Extend hold by 5 minutes'),
                    ),
                  ],
                  if (draft.paymentMethod == 'CASH') ...<Widget>[
                    const SizedBox(height: 6),
                    const Text('Cash bookings are created immediately, but settlement remains pending until payment is collected at the visit.'),
                  ] else if (draft.paymentMethod == 'WALLET') ...<Widget>[
                    const SizedBox(height: 6),
                    const Text('Wallet bookings may remain pending when gateway capture is running in manual review mode.'),
                  ],
                  const SizedBox(height: 12),
                  DropdownButtonFormField<String>(
                    initialValue: draft.paymentMethod,
                    items: allowedMethods.map((String option) => DropdownMenuItem<String>(value: option, child: Text(option))).toList(),
                    onChanged: (String? value) => setState(() {
                      draft.paymentMethod = value ?? draft.paymentMethod;
                      if (draft.paymentMethod != 'WALLET') {
                        draft.walletMethodId = null;
                      } else {
                        _walletMethodsFuture = _loadWalletMethods();
                      }
                    }),
                    decoration: const InputDecoration(labelText: 'Payment method'),
                  ),
                  if (draft.paymentMethod == 'WALLET') ...<Widget>[
                    const SizedBox(height: 12),
                    if (walletSnapshot.connectionState == ConnectionState.waiting)
                      const LinearProgressIndicator()
                    else if (walletMethods.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(color: const Color(0xFFFFF7ED), borderRadius: BorderRadius.circular(16), border: Border.all(color: const Color(0xFFF59E0B))),
                        child: const Text('No saved wallet methods found. Open Wallet & Payment Methods to add one before booking with Wallet.'),
                      )
                    else
                      DropdownButtonFormField<String>(
                        initialValue: draft.walletMethodId,
                        items: walletMethods.map((Map<String, dynamic> method) {
                          final String suffix = method['isDefault'] == true ? ' · Default' : '';
                          return DropdownMenuItem<String>(
                            value: method['id']?.toString(),
                            child: Text('${method['label']}$suffix'),
                          );
                        }).toList(),
                        onChanged: (String? value) => setState(() => draft.walletMethodId = value),
                        decoration: const InputDecoration(labelText: 'Saved wallet method'),
                      ),
                    const SizedBox(height: 8),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        onPressed: () => context.push('/wallet/methods').then((_) {
                          if (!mounted) return;
                          setState(() {
                            _walletMethodsFuture = _loadWalletMethods();
                          });
                        }),
                        child: const Text('Manage wallet methods'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('Booking policy', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text('Cancellation window: at least $cancellationWindow hours before the visit.'),
                  Text('Refund review window: up to $refundWindow hours before the visit unless an override is approved.'),
                  if (policy['authorizationRequired'] == true) const Text('Prior authorization is required for this service and must be confirmed before booking.'),
                  if (draft.insuranceDocumentId != null || draft.identityDocumentId != null || draft.authorizationDocumentId != null)
                    Text('Linked booking documents: ${[draft.insuranceDocumentId, draft.identityDocumentId, draft.authorizationDocumentId].where((String? value) => value != null && value.isNotEmpty).length}'),
                  if (draft.paymentMethod == 'CASH')
                    const Text('Expected payment status after confirmation: PENDING until onsite collection is complete.'),
                  const SizedBox(height: 8),
                  CheckboxListTile(
                    value: draft.policyAccepted,
                    onChanged: (bool? value) => setState(() => draft.policyAccepted = value ?? false),
                    contentPadding: EdgeInsets.zero,
                    controlAffinity: ListTileControlAffinity.leading,
                    title: const Text('I reviewed and accept the cancellation and refund policy for this booking.'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(color: Colors.white, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text('Clinical details', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(draft.visitReason.isEmpty ? 'No visit reason captured.' : draft.visitReason),
                  if (draft.symptoms.isNotEmpty) ...<Widget>[
                    const SizedBox(height: 6),
                    Text(draft.symptoms),
                  ],
                ],
              ),
            ),
            if (_error != null) ...<Widget>[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: Colors.red)),
            ],
          ],
            );
          },
        ),
      ),
      bottomNavigationBar: SafeArea(
        minimum: const EdgeInsets.all(24),
        child: AppPrimaryButton(label: _loading ? 'Processing…' : 'Confirm & Pay', onPressed: (_loading || !draft.policyAccepted || (draft.paymentMethod == 'WALLET' && (draft.walletMethodId == null || draft.walletMethodId!.isEmpty))) ? null : _confirm),
      ),
    );
  }
}
