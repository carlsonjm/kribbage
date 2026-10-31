#include <QApplication>
#include <QQmlApplicationEngine>
#include <QQuickStyle>
#include <QSurfaceFormat>
#include <QtQuick3D/qquick3d.h>

#include <KAboutData>
#include <KLocalizedString>

int main(int argc, char *argv[])
{
    // A depth buffer and multisampling for the 3D trail.
    QSurfaceFormat::setDefaultFormat(QQuick3D::idealSurfaceFormat(4));
    QApplication app(argc, argv);
    QCoreApplication::setOrganizationName(QStringLiteral("Good Input"));
    KLocalizedString::setApplicationDomain("kribbage");

    KAboutData about(QStringLiteral("kribbage"), i18n("Kribbage"), QStringLiteral("0.1.0"),
                     i18n("Cribbage for two: you and the computer"), KAboutLicense::GPL_V3,
                     i18n("© 2026 Good Input"));
    about.setDesktopFileName(QStringLiteral("co.goodinput.Kribbage"));
    about.setOrganizationDomain("goodinput.co");
    KAboutData::setApplicationData(about);

    if (qEnvironmentVariableIsEmpty("QT_QUICK_CONTROLS_STYLE"))
        QQuickStyle::setStyle(QStringLiteral("org.kde.desktop"));

    QQmlApplicationEngine engine;
    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app,
                     [] { QCoreApplication::exit(1); }, Qt::QueuedConnection);
    engine.loadFromModule("co.goodinput.Kribbage", "Main");
    return app.exec();
}
