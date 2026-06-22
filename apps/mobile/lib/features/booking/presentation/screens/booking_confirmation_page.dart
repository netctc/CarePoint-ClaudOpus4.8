import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../../app/theme/app_colors.dart';
import '../../../../core/state/app_session.dart';
import '../../../../core/state/booking_draft.dart';
import '../../../../core/widgets/app_primary_button.dart';
import '../../../../core/widgets/patient_ui.dart';

class BookingConfirmationPage extends StatefulWidget {
  const BookingConfirmationPage({super.key});

  @override
  State<BookingConfirmationPage> createState() => _BookingConfirmationPageState();
}

class _BookingConfirmationPageState extends State<BookingConfirmationPage> {
  Map<String, dynamic>? _consent;
  bool _loadingConsent = false;
  bool _updatingConsent = false;
  bool _promptShown = false;
  String? _consentError;

  BookingDraft get _draft => BookingDraft.instance;
  String? get _appointmentId => _draft.appointmentId;
  bool get _authorized => (_draft.paymentStatus ?? '').toUpperCase() == 'AUTHORIZED';
  String get _consentStatus => _consent?['consentStatus']?.toString() ?? 'PENDING';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadConsent(showPromptAfterLoad: true);
    });
  }

  Future<void> _loadConsent({bool showPromptAfterLoad = false}) async {
    final String? appointmentId = _appointmentId;
    if (appointmentId == null || appointmentId.isEmpty) {
      return;
    }
    if (mounted) {
      setState(() {
        _loadingConsent = true;
        _consentError = null;
      });
    }
    try {
      final Map<String, dynamic> response = await AppSession.instance.appointmentAccessConsent(appointmentId);
      final Map<String, dynamic>? consent = (response['consent'] as Map?)?.cast<String, dynamic>();
      if (!mounted) return;
      setState(() {
        _consent = consent;
      });
      if (showPromptAfterLoad && !_promptShown && _consentStatus != 'GRANTED') {
        _promptShown = true;
        await _showConsentPrompt();
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _consentError = AppSession.instance.lastError ?? error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _loadingConsent = false;
        });
      }
    }
  }

  Future<void> _showConsentPrompt() async {
    final String? action = await showModalBottomSheet<String>(
      context: context,
      isDismissible: true,
      showDragHandle: true,
      builder: (BuildContext modalContext) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text('Allow doctor access now?', style: Theme.of(modalContext).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800)),
                const SizedBox(height: 8),
                Text(
                  'Your booking is saved. Grant access so the doctor can review the health questionnaire, latest vitals, and relevant reports for ${AppSession.instance.activeSubjectLabel} before the visit.',
                  style: Theme.of(modalContext).textTheme.bodyMedium,
                ),
                const SizedBox(height: 14),
                PatientTintedCard(
                  tint: const Color(0xFFF8FAFC),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text('Current access status', style: Theme.of(modalContext).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 6),
                      PatientStatusBadge(label: _consentStatusLabel(_consentStatus)),
                      const SizedBox(height: 8),
                      const Text('You can revoke this later at any time from the same appointment detail page.'),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => Navigator.of(modalContext).pop('later'),
                        child: const Text('Later'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: FilledButton.icon(
                        onPressed: () => Navigator.of(modalContext).pop('grant'),
                        icon: const Icon(Icons.verified_user_outlined),
                        label: const Text('Grant access'),
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

    if (!mounted) return;
    if (action == 'grant') {
      await _mutateConsent(grant: true, showSnackBar: true);
    }
  }

  Future<void> _mutateConsent({required bool grant, bool showSnackBar = false}) async {
    final String? appointmentId = _appointmentId;
    if (appointmentId == null || appointmentId.isEmpty) return;
    setState(() {
      _updatingConsent = true;
      _consentError = null;
    });
    try {
      if (grant) {
        final Map<String, dynamic> response = await AppSession.instance.grantAppointmentAccessConsent(
          appointmentId,
          note: 'Updated from booking confirmation',
        );
        _consent = (response['consent'] as Map?)?.cast<String, dynamic>() ?? _consent;
      } else {
        final Map<String, dynamic> response = await AppSession.instance.revokeAppointmentAccessConsent(
          appointmentId,
          note: 'Updated from booking confirmation',
        );
        _consent = (response['consent'] as Map?)?.cast<String, dynamic>() ?? _consent;
      }
      if (!mounted) return;
      setState(() {});
      if (showSnackBar) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(grant ? 'Doctor access granted for this appointment.' : 'Doctor access revoked for this appointment.')),
        );
      }
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _consentError = AppSession.instance.lastError ?? error.toString();
      });
    } finally {
      if (mounted) {
        setState(() {
          _updatingConsent = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final String heroTitle = _authorized ? 'Your appointment is confirmed.' : 'Your booking request is pending review.';
    final String heroBody = _draft.paymentNextActionMessage ??
        (_authorized ? 'Payment intent created and booking draft finalized.' : 'Payment intent was created, but final confirmation may wait for policy or gateway review.');

    return PatientScaffold(
      showNavigation: false,
      showBack: false,
      title: 'Booking complete',
      subtitle: 'Review the booking, payment outcome, and provider access before returning to your dashboard.',
      bottomAction: SafeArea(
        minimum: const EdgeInsets.fromLTRB(24, 0, 24, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            AppPrimaryButton(label: 'View appointments', onPressed: () => context.go('/appointments/upcoming')),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.tonal(
                onPressed: _appointmentId == null ? null : () => context.go('/appointments/detail?id=$_appointmentId'),
                child: const Text('Manage doctor access'),
              ),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {
                  _draft.reset();
                  context.go('/home');
                },
                child: const Text('Back to home'),
              ),
            ),
          ],
        ),
      ),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(24, 10, 24, 24),
        children: <Widget>[
          PatientHeroCard(
            badge: _authorized ? 'Confirmed' : 'Pending review',
            title: heroTitle,
            subtitle: heroBody,
          ),
          const SizedBox(height: 18),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const PatientSectionTitle(title: 'Appointment summary'),
                const SizedBox(height: 12),
                _LineItem(label: 'Appointment ID', value: _draft.appointmentId ?? '—'),
                _LineItem(label: 'Profile', value: AppSession.instance.activeSubjectLabel),
                _LineItem(label: 'Provider', value: _draft.providerName ?? '—'),
                _LineItem(label: 'Service', value: _draft.service),
                _LineItem(label: 'Appointment type', value: _draft.appointmentType == 'ONLINE_MEETING' ? 'Online Meeting' : 'In-Person Visit'),
                _LineItem(label: 'Location', value: _draft.location),
                _LineItem(label: 'Time', value: _draft.startsAt == null ? '—' : DateFormat('EEE, d MMM • h:mm a').format(_draft.startsAt!.toLocal())),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const PatientSectionTitle(title: 'Doctor access consent'),
                const SizedBox(height: 12),
                Text(
                  'After each booking, the patient should be prompted to grant doctor access and still be able to revoke it later from the same appointment flow.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary),
                ),
                const SizedBox(height: 12),
                Builder(
                  builder: (BuildContext rowContext) {
                    final Map<String, dynamic>? consent = _consent;
                    final String updatedAtText = (consent?['updatedAt']?.toString() ?? '');
                    return Row(
                      children: <Widget>[
                        Expanded(
                          child: _loadingConsent
                              ? const LinearProgressIndicator(minHeight: 6)
                              : Align(
                                  alignment: AlignmentDirectional.centerStart,
                                  child: PatientStatusBadge(label: _consentStatusLabel(_consentStatus)),
                                ),
                        ),
                        if (updatedAtText.isNotEmpty)
                          Text(
                            _formatDate(consent?['updatedAt']),
                            style: Theme.of(rowContext).textTheme.bodySmall,
                          ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 12),
                if (_consentError != null) ...<Widget>[
                  PatientTintedCard(
                    tint: const Color(0xFFFEE2E2),
                    child: Text(_consentError!, style: Theme.of(context).textTheme.bodyMedium),
                  ),
                  const SizedBox(height: 12),
                ],
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: <Widget>[
                    FilledButton.icon(
                      onPressed: _updatingConsent ? null : () => _mutateConsent(grant: true, showSnackBar: true),
                      icon: _updatingConsent && _consentStatus != 'GRANTED'
                          ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                          : const Icon(Icons.verified_user_outlined),
                      label: const Text('Grant access now'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _updatingConsent ? null : () => _mutateConsent(grant: false, showSnackBar: true),
                      icon: const Icon(Icons.block_outlined),
                      label: const Text('Revoke access'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _loadingConsent || _updatingConsent ? null : () => _loadConsent(),
                      icon: const Icon(Icons.refresh_outlined),
                      label: const Text('Refresh status'),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  'This applies to ${AppSession.instance.activeSubjectLabel} and can be changed later from appointment details.',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          PatientCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                const PatientSectionTitle(title: 'Payment & policy state'),
                const SizedBox(height: 12),
                _LineItem(label: 'Payment ID', value: _draft.paymentId ?? '—'),
                _LineItem(label: 'Payment status', value: _draft.paymentStatus ?? '—'),
                if (_draft.paymentReviewReasons.isNotEmpty) _LineItem(label: 'Review reasons', value: _draft.paymentReviewReasons.join(', ')),
                if ((_draft.paymentNextActionTitle ?? '').isNotEmpty) _LineItem(label: 'Next step', value: _draft.paymentNextActionTitle!),
                if ((_draft.paymentNextActionMessage ?? '').isNotEmpty) ...<Widget>[
                  const SizedBox(height: 8),
                  Text(_draft.paymentNextActionMessage!, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary)),
                ],
                if (_draft.paymentNextSteps.isNotEmpty) ...<Widget>[
                  const SizedBox(height: 12),
                  ..._draft.paymentNextSteps.map((String step) => Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            const Text('• '),
                            Expanded(child: Text(step, style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textPrimary))),
                          ],
                        ),
                      )),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

String _consentStatusLabel(String status) {
  switch (status.toUpperCase()) {
    case 'GRANTED':
      return 'Granted';
    case 'REVOKED':
      return 'Revoked';
    default:
      return 'Pending';
  }
}

String _formatDate(dynamic value) {
  final DateTime? parsed = value == null ? null : DateTime.tryParse(value.toString())?.toLocal();
  if (parsed == null) return '—';
  return DateFormat('d MMM • h:mm a').format(parsed);
}

class _LineItem extends StatelessWidget {
  const _LineItem({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(width: 118, child: Text(label, style: Theme.of(context).textTheme.bodySmall)),
          Expanded(child: Text(value, style: Theme.of(context).textTheme.bodyLarge?.copyWith(color: AppColors.textPrimary))),
        ],
      ),
    );
  }
}
