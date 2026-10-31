cmake_minimum_required(VERSION 3.22)
project(kribbage VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(ECM 6.0 REQUIRED NO_MODULE)
set(CMAKE_MODULE_PATH ${ECM_MODULE_PATH})
include(KDEInstallDirs)
include(KDECMakeSettings)
include(KDECompilerSettings NO_POLICY_SCOPE)

find_package(Qt6 6.6 REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2)
find_package(KF6 6.0 REQUIRED COMPONENTS Kirigami I18n CoreAddons)

qt_policy(SET QTP0001 NEW)

qt_add_executable(kribbage src/main.cpp)

# The rules engine is plain JavaScript shared with the node tests in test/.
qt_add_qml_module(kribbage
    URI co.goodinput.Kribbage
    VERSION 1.0
    QML_FILES
        qml/Main.qml
        qml/GameController.qml
        engine/cards.mjs
        engine/score.mjs
        engine/game.mjs
        engine/ai.mjs
        engine/fate.mjs
        engine/match.mjs
)

target_link_libraries(kribbage PRIVATE
    Qt6::Core Qt6::Gui Qt6::Qml Qt6::Quick Qt6::QuickControls2
    KF6::I18n KF6::CoreAddons)

install(TARGETS kribbage ${KDE_INSTALL_TARGETS_DEFAULT_ARGS})
install(FILES packaging/co.goodinput.Kribbage.desktop DESTINATION ${KDE_INSTALL_APPDIR})
install(FILES packaging/co.goodinput.Kribbage.metainfo.xml DESTINATION ${KDE_INSTALL_METAINFODIR})

enable_testing()
find_program(NODE node)
if(NODE)
    add_test(NAME engine COMMAND ${NODE} --test ${CMAKE_SOURCE_DIR}/test/score.test.mjs ${CMAKE_SOURCE_DIR}/test/game.test.mjs)
endif()
