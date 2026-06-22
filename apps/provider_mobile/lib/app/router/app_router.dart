import 'package:go_router/go_router.dart';

import '../../core/state/provider_session.dart';
import '../../core/widgets/provider_ui.dart';
import '../../features/alerts/presentation/screens/provider_alerts_page.dart';
import '../../features/analytics/presentation/screens/provider_analytics_page.dart';
import '../../features/appointments/presentation/screens/provider_appointment_detail_page.dart';
import '../../features/appointments/presentation/screens/provider_queue_page.dart';
import '../../features/auth/presentation/screens/otp_verification_page.dart';
import '../../features/auth/presentation/screens/sign_in_page.dart';
import '../../features/auth/presentation/screens/welcome_page.dart';
import '../../features/calendar/presentation/screens/provider_calendar_page.dart';
import '../../features/calendar/presentation/screens/provider_schedule_manager_page.dart';
import '../../features/dashboard/presentation/screens/provider_dashboard_page.dart';
import '../../features/encounters/presentation/screens/provider_encounter_note_page.dart';
import '../../features/labs/presentation/screens/provider_lab_result_page.dart';
import '../../features/labs/presentation/screens/provider_labs_page.dart';
import '../../features/messages/presentation/screens/provider_message_thread_page.dart';
import '../../features/onboarding/presentation/screens/provider_onboarding_page.dart';
import '../../features/messages/presentation/screens/provider_messages_page.dart';
import '../../features/offline/presentation/screens/provider_offline_queue_page.dart';
import '../../features/orders/presentation/screens/provider_order_composer_page.dart';
import '../../features/orders/presentation/screens/provider_order_detail_page.dart';
import '../../features/orders/presentation/screens/provider_orders_page.dart';
import '../../features/prescriptions/presentation/screens/provider_prescription_composer_page.dart';
import '../../features/prescriptions/presentation/screens/provider_prescription_detail_page.dart';
import '../../features/prescriptions/presentation/screens/provider_prescriptions_page.dart';
import '../../features/prescriptions/presentation/screens/provider_refill_request_detail_page.dart';
import '../../features/records/presentation/screens/provider_chart_page.dart';
import '../../features/records/presentation/screens/provider_record_detail_page.dart';
import '../../features/records/presentation/screens/provider_records_page.dart';
import '../../features/rpm/presentation/screens/provider_rpm_page.dart';
import '../../features/rpm/presentation/screens/provider_rpm_patient_page.dart';
import '../../features/settings/presentation/screens/provider_settings_page.dart';
import '../../features/settings/presentation/screens/provider_hsp_access_page.dart';
import '../../features/settings/presentation/screens/provider_notification_preferences_page.dart';
import '../../features/settings/presentation/screens/provider_facility_detail_page.dart';
import '../../features/team/presentation/screens/provider_team_page.dart';
import '../../features/telehealth/presentation/screens/provider_telehealth_page.dart';
import '../../features/telehealth/presentation/screens/provider_telehealth_session_page.dart';

const Set<String> _publicPaths = <String>{'/welcome', '/sign-in', '/otp'};

final GoRouter appRouter = GoRouter(
  initialLocation: '/welcome',
  refreshListenable: ProviderSession.instance,
  redirect: (context, state) {
    final ProviderSession session = ProviderSession.instance;
    final String location = state.matchedLocation;
    if (!session.isAuthenticated && !_publicPaths.contains(location)) {
      return '/welcome';
    }
    if (session.isAuthenticated && _publicPaths.contains(location)) {
      return '/dashboard';
    }
    return null;
  },
  routes: <RouteBase>[
    GoRoute(path: '/welcome', builder: (context, state) => const WelcomePage()),
    GoRoute(path: '/sign-in', builder: (context, state) => const SignInPage()),
    GoRoute(path: '/otp', builder: (context, state) => const OtpVerificationPage()),
    ShellRoute(
      builder: (context, state, child) => ProviderShell(child: child),
      routes: <RouteBase>[
        GoRoute(path: '/dashboard', builder: (context, state) => const ProviderDashboardPage()),
        GoRoute(path: '/queue', builder: (context, state) => const ProviderQueuePage()),
        GoRoute(path: '/appointments/:appointmentId', builder: (context, state) => ProviderAppointmentDetailPage(appointmentId: state.pathParameters['appointmentId']!)),
        GoRoute(path: '/calendar', builder: (context, state) => const ProviderCalendarPage()),
        GoRoute(path: '/calendar/manage', builder: (context, state) => const ProviderScheduleManagerPage()),
        GoRoute(path: '/messages', builder: (context, state) => const ProviderMessagesPage()),
        GoRoute(path: '/messages/thread/:threadId', builder: (context, state) => ProviderMessageThreadPage(threadId: state.pathParameters['threadId']!)),
        GoRoute(path: '/alerts', builder: (context, state) => const ProviderAlertsPage()),
        GoRoute(path: '/telehealth', builder: (context, state) => const ProviderTelehealthPage()),
        GoRoute(path: '/telehealth/:sessionId', builder: (context, state) => ProviderTelehealthSessionPage(sessionId: state.pathParameters['sessionId']!)),
        GoRoute(path: '/records', builder: (context, state) => const ProviderRecordsPage()),
        GoRoute(path: '/records/:recordId', builder: (context, state) => ProviderRecordDetailPage(recordId: state.pathParameters['recordId']!)),
        GoRoute(
          path: '/chart/:patientId',
          builder: (context, state) => ProviderChartPage(
            patientId: state.pathParameters['patientId']!,
            patientName: state.uri.queryParameters['patientName'],
            subjectProfileId: state.uri.queryParameters['subjectProfileId'],
            subjectLabel: state.uri.queryParameters['subjectLabel'],
            subjectRelationship: state.uri.queryParameters['subjectRelationship'],
          ),
        ),
        GoRoute(
          path: '/encounters/new',
          builder: (context, state) => ProviderEncounterNotePage(
            patientId: state.uri.queryParameters['patientId'] ?? '',
            appointmentId: state.uri.queryParameters['appointmentId'],
            patientName: state.uri.queryParameters['patientName'],
            subjectProfileId: state.uri.queryParameters['subjectProfileId'],
            subjectLabel: state.uri.queryParameters['subjectLabel'],
            subjectRelationship: state.uri.queryParameters['subjectRelationship'],
          ),
        ),
        GoRoute(path: '/orders', builder: (context, state) => const ProviderOrdersPage()),
        GoRoute(
          path: '/orders/new',
          builder: (context, state) => ProviderOrderComposerPage(
            patientId: state.uri.queryParameters['patientId'],
            appointmentId: state.uri.queryParameters['appointmentId'],
            patientName: state.uri.queryParameters['patientName'],
            subjectProfileId: state.uri.queryParameters['subjectProfileId'],
            subjectLabel: state.uri.queryParameters['subjectLabel'],
            subjectRelationship: state.uri.queryParameters['subjectRelationship'],
          ),
        ),
        GoRoute(path: '/orders/:orderId', builder: (context, state) => ProviderOrderDetailPage(orderId: state.pathParameters['orderId']!)),
        GoRoute(path: '/prescriptions', builder: (context, state) => const ProviderPrescriptionsPage()),
        GoRoute(
          path: '/prescriptions/new',
          builder: (context, state) => ProviderPrescriptionComposerPage(
            patientId: state.uri.queryParameters['patientId'],
            appointmentId: state.uri.queryParameters['appointmentId'],
            patientName: state.uri.queryParameters['patientName'],
            subjectProfileId: state.uri.queryParameters['subjectProfileId'],
            subjectLabel: state.uri.queryParameters['subjectLabel'],
            subjectRelationship: state.uri.queryParameters['subjectRelationship'],
          ),
        ),
        GoRoute(path: '/prescriptions/refills/:requestId', builder: (context, state) => ProviderRefillRequestDetailPage(requestId: state.pathParameters['requestId']!)),
        GoRoute(path: '/prescriptions/:prescriptionId', builder: (context, state) => ProviderPrescriptionDetailPage(prescriptionId: state.pathParameters['prescriptionId']!)),
        GoRoute(path: '/labs', builder: (context, state) => const ProviderLabsPage()),
        GoRoute(path: '/labs/:resultId', builder: (context, state) => ProviderLabResultPage(resultId: state.pathParameters['resultId']!)),
        GoRoute(path: '/rpm', builder: (context, state) => const ProviderRpmPage()),
        GoRoute(path: '/rpm/:patientId', builder: (context, state) => ProviderRpmPatientPage(patientId: state.pathParameters['patientId']!, patientName: state.uri.queryParameters['patientName'])),
        GoRoute(path: '/analytics', builder: (context, state) => const ProviderAnalyticsPage()),
        GoRoute(path: '/team', builder: (context, state) => const ProviderTeamPage()),
        GoRoute(path: '/settings/offline-queue', builder: (context, state) => const ProviderOfflineQueuePage()),
        GoRoute(path: '/settings/onboarding', builder: (context, state) => const ProviderOnboardingPage()),
        GoRoute(path: '/settings/hsp-access', builder: (context, state) => const ProviderHspAccessPage()),
        GoRoute(path: '/settings/notifications', builder: (context, state) => const ProviderNotificationPreferencesPage()),
        GoRoute(path: '/settings/facilities/:facilityId', builder: (context, state) => ProviderFacilityDetailPage(facilityId: state.pathParameters['facilityId']!)),
        GoRoute(path: '/settings', builder: (context, state) => const ProviderSettingsPage()),
      ],
    ),
  ],
);
