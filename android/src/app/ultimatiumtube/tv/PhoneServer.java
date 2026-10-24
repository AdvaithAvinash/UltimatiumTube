package app.ultimatiumtube.tv;

import android.content.res.AssetManager;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.util.Enumeration;
import java.util.HashMap;
import java.util.Map;

/**
 * Serves the settings page to a phone or computer on the same network, the way the Tizen service
 * does. Plain sockets: nothing else is needed for three routes.
 */
final class PhoneServer {
    static final int PORT = 8189;
    private static final int LIMIT = 256 * 1024;

    private final AssetManager assets;
    private final PhoneSettings settings;
    private volatile boolean running = true;
    private ServerSocket socket;
    private byte[] page;

    PhoneServer(AssetManager assets, PhoneSettings settings) {
        this.assets = assets;
        this.settings = settings;
    }

    /** The first address of this device that is not loopback, which is what a phone is asked to open. */
    static String address() {
        try {
            Enumeration<NetworkInterface> interfaces = NetworkInterface.getNetworkInterfaces();
            while (interfaces != null && interfaces.hasMoreElements()) {
                Enumeration<InetAddress> addresses = interfaces.nextElement().getInetAddresses();
                while (addresses.hasMoreElements()) {
                    InetAddress found = addresses.nextElement();
                    if (!found.isLoopbackAddress() && found.getAddress().length == 4) {
                        return "http://" + found.getHostAddress() + ":" + PORT + "/settings";
                    }
                }
            }
        } catch (IOException ignored) {
            // No network: the page tells the viewer to look under About instead.
        }
        return "";
    }

    void start() {
        Thread thread = new Thread(new Runnable() {
            @Override public void run() { serve(); }
        }, "phone-settings");
        thread.setDaemon(true);
        thread.start();
    }

    void stop() {
        running = false;
        try {
            if (socket != null) socket.close();
        } catch (IOException ignored) {
            // Closing anyway.
        }
    }

    private void serve() {
        try {
            socket = new ServerSocket(PORT);
        } catch (IOException e) {
            // The port is taken: the phone page is then unavailable, and nothing else is affected.
            return;
        }

        while (running) {
            try {
                final Socket client = socket.accept();
                Thread worker = new Thread(new Runnable() {
                    @Override public void run() { answer(client); }
                });
                worker.setDaemon(true);
                worker.start();
            } catch (IOException e) {
                if (!running) return;
            }
        }
    }

    private byte[] page() throws IOException {
        if (page == null) {
            InputStream in = assets.open("phone.html");
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] chunk = new byte[8192];
            int read;
            while ((read = in.read(chunk)) != -1) out.write(chunk, 0, read);
            in.close();
            page = out.toByteArray();
        }
        return page;
    }

    private static String readLine(InputStream in) throws IOException {
        StringBuilder line = new StringBuilder();
        int c;
        while ((c = in.read()) != -1) {
            if (c == '\n') break;
            if (c != '\r') line.append((char) c);
            if (line.length() > 8192) break;
        }
        return c == -1 && line.length() == 0 ? null : line.toString();
    }

    private void answer(Socket client) {
        try {
            client.setSoTimeout(10000);
            InputStream in = client.getInputStream();
            String request = readLine(in);
            if (request == null) return;

            String[] parts = request.split(" ");
            String method = parts.length > 0 ? parts[0] : "";
            String path = parts.length > 1 ? parts[1] : "/";
            int query = path.indexOf('?');
            if (query != -1) path = path.substring(0, query);

            Map<String, String> headers = new HashMap<String, String>();
            String line;
            while ((line = readLine(in)) != null && line.length() > 0) {
                int colon = line.indexOf(':');
                if (colon > 0) headers.put(line.substring(0, colon).trim().toLowerCase(), line.substring(colon + 1).trim());
            }

            String body = "";
            if ("POST".equals(method)) {
                int length = 0;
                try {
                    length = Integer.parseInt(headers.containsKey("content-length") ? headers.get("content-length") : "0");
                } catch (NumberFormatException ignored) {
                    length = 0;
                }

                if (length > LIMIT) {
                    send(client, 413, "application/json", "{\"error\":\"too large\"}".getBytes("UTF-8"));
                    return;
                }

                byte[] raw = new byte[length];
                int got = 0;
                while (got < length) {
                    int read = in.read(raw, got, length - got);
                    if (read == -1) break;
                    got += read;
                }
                body = new String(raw, 0, got, "UTF-8");
            }

            route(client, method, path, headers, body);
        } catch (IOException ignored) {
            // A phone that went away mid-request.
        } finally {
            try {
                client.close();
            } catch (IOException ignored) {
                // Done with it.
            }
        }
    }

    private void route(Socket client, String method, String path, Map<String, String> headers, String body)
            throws IOException {
        if ("GET".equals(method) && ("/settings".equals(path) || "/".equals(path))) {
            send(client, 200, "text/html; charset=utf-8", page());
        } else if ("GET".equals(method) && "/api/settings".equals(path)) {
            send(client, 200, "application/json", settings.read(address()).getBytes("UTF-8"));
        } else if ("POST".equals(method) && "/api/settings".equals(path)) {
            // A page on another site can send a form post but not a custom header.
            if (!headers.containsKey("x-tube")) {
                send(client, 403, "application/json", "{\"error\":\"missing x-tube header\"}".getBytes("UTF-8"));
                return;
            }

            int taken = settings.change(body);
            if (taken < 0) {
                send(client, 409, "application/json", "{\"error\":\"the TV has not connected yet\"}".getBytes("UTF-8"));
            } else {
                send(client, 200, "application/json", ("{\"ok\":true,\"taken\":" + taken + "}").getBytes("UTF-8"));
            }
        } else if ("GET".equals(method) && "/diag".equals(path)) {
            send(client, 200, "text/plain; charset=utf-8", "UltimatiumTube for Android TV\n".getBytes("UTF-8"));
        } else {
            send(client, 404, "text/plain", "not found".getBytes("UTF-8"));
        }
    }

    private static void send(Socket client, int status, String type, byte[] body) throws IOException {
        String reason = status == 200 ? "OK" : status == 403 ? "Forbidden" : status == 404 ? "Not Found"
                : status == 409 ? "Conflict" : status == 413 ? "Payload Too Large" : "Error";

        String head = "HTTP/1.1 " + status + " " + reason + "\r\n"
                + "Content-Type: " + type + "\r\n"
                + "Content-Length: " + body.length + "\r\n"
                + "Cache-Control: no-store\r\n"
                + "Connection: close\r\n\r\n";

        OutputStream out = client.getOutputStream();
        out.write(head.getBytes("UTF-8"));
        out.write(body);
        out.flush();
    }
}
