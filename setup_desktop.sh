#!/bin/bash

set -e

LOG_FILE="/var/log/desktop_setup.log"
DISPLAY_NUM=":0"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        echo "This script must be run as root (use sudo)"
        exit 1
    fi
}

update_system() {
    log "Updating system packages..."
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
}

install_if_missing() {
    local package=$1
    if ! dpkg -l | grep -q "^ii  $package "; then
        log "Installing $package..."
        DEBIAN_FRONTEND=noninteractive apt-get install -y "$package"
    else
        log "$package is already installed"
    fi
}

install_basic_packages() {
    log "Installing basic packages..."
    install_if_missing "tmux"
    install_if_missing "xdotool"
    install_if_missing "scrot"
    install_if_missing "xvfb"
    install_if_missing "x11vnc"
    install_if_missing "xfce4"
    install_if_missing "xfce4-goodies"
    install_if_missing "firefox-esr"
    install_if_missing "dbus-x11"
    install_if_missing "at-spi2-core"
    install_if_missing "supervisor"
    install_if_missing "pulseaudio"
}

setup_xvfb_service() {
    log "Setting up Xvfb service..."
    cat > /etc/systemd/system/xvfb.service << 'EOF'
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
ExecStart=/usr/bin/Xvfb :0 -screen 0 1024x768x24 -ac +extension GLX +render -noreset
Restart=on-failure
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable xvfb
    systemctl start xvfb
    sleep 2
}

setup_desktop_service() {
    log "Setting up desktop service..."
    cat > /etc/systemd/system/desktop.service << 'EOF'
[Unit]
Description=XFCE Desktop Environment
After=xvfb.service
Requires=xvfb.service

[Service]
Environment=DISPLAY=:0
Environment=XDG_RUNTIME_DIR=/tmp/runtime-root
Environment=PULSE_RUNTIME_PATH=/tmp/pulse-runtime
ExecStartPre=/bin/mkdir -p /tmp/runtime-root
ExecStartPre=/bin/chmod 700 /tmp/runtime-root
ExecStartPre=/bin/mkdir -p /tmp/pulse-runtime
ExecStart=/usr/bin/startxfce4
Restart=on-failure
User=root
Group=root
WorkingDirectory=/root

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable desktop
    systemctl start desktop
    sleep 5
}

setup_browser_autostart() {
    log "Setting up browser autostart..."
    mkdir -p /root/.config/autostart

    cat > /root/.config/autostart/firefox.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=Firefox
Exec=firefox --new-window https://www.google.com
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF

    cat > /root/.config/autostart/file-manager.desktop << 'EOF'
[Desktop Entry]
Type=Application
Name=File Manager
Exec=thunar
Hidden=false
NoDisplay=false
X-GNOME-Autostart-enabled=true
EOF
}

setup_vnc_service() {
    log "Setting up VNC service for remote access..."
    cat > /etc/systemd/system/x11vnc.service << 'EOF'
[Unit]
Description=x11vnc service
After=desktop.service
Requires=desktop.service

[Service]
Environment=DISPLAY=:0
ExecStart=/usr/bin/x11vnc -forever -usepw -create -shared -rfbauth /root/.vnc/passwd
Restart=on-failure
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

    mkdir -p /root/.vnc
    x11vnc -storepasswd desktop123 /root/.vnc/passwd

    systemctl daemon-reload
    systemctl enable x11vnc
    systemctl start x11vnc
}

test_screenshot() {
    log "Testing screenshot functionality..."
    export DISPLAY=:0
    sleep 10

    if scrot /tmp/test_screenshot.png 2>/dev/null; then
        log "Screenshot test successful! File saved to /tmp/test_screenshot.png"
        ls -la /tmp/test_screenshot.png
    else
        log "Screenshot test failed"
        return 1
    fi
}

create_desktop_script() {
    log "Creating desktop management script..."
    cat > /usr/local/bin/desktop-control << 'EOF'
#!/bin/bash

case "$1" in
    start)
        systemctl start xvfb desktop x11vnc
        echo "Desktop services started"
        ;;
    stop)
        systemctl stop x11vnc desktop xvfb
        echo "Desktop services stopped"
        ;;
    restart)
        systemctl restart xvfb desktop x11vnc
        echo "Desktop services restarted"
        ;;
    status)
        echo "=== Xvfb Status ==="
        systemctl status xvfb --no-pager -l
        echo "=== Desktop Status ==="
        systemctl status desktop --no-pager -l
        echo "=== VNC Status ==="
        systemctl status x11vnc --no-pager -l
        ;;
    screenshot)
        export DISPLAY=:0
        FILENAME="/tmp/desktop_$(date +%Y%m%d_%H%M%S).png"
        if scrot "$FILENAME"; then
            echo "Screenshot saved to: $FILENAME"
        else
            echo "Screenshot failed"
            exit 1
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|screenshot}"
        exit 1
        ;;
esac
EOF

    chmod +x /usr/local/bin/desktop-control
}

main() {
    log "Starting desktop setup script..."

    check_root
    update_system
    install_basic_packages
    setup_xvfb_service
    setup_desktop_service
    setup_browser_autostart
    setup_vnc_service
    create_desktop_script

    log "Waiting for desktop to fully load..."
    sleep 15

    test_screenshot

    log "Setup complete!"
    log "Use 'desktop-control status' to check services"
    log "Use 'desktop-control screenshot' to take screenshots"
    log "VNC is available on port 5900 (password: desktop123)"

    echo ""
    echo "=== Setup Summary ==="
    echo "✓ tmux, xdotool, scrot installed"
    echo "✓ X server running on display :0"
    echo "✓ XFCE desktop environment active"
    echo "✓ Firefox and file manager auto-start"
    echo "✓ VNC server for remote access"
    echo "✓ Management script: desktop-control"
    echo ""
    echo "Test screenshot: desktop-control screenshot"
}

main "$@"
