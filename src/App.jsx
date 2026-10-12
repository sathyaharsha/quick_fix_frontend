
import { useCallback, useEffect, useState } from "react";
import "./App.css";
import AdminDashboard from "./AdminDashboard";

import { API } from "./apiConfig";

async function readResponse(response, fallbackMessage) {
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg =
      data.detail ||
      data.message ||
      (data.error && data.error !== "Bad Request" ? data.error : null) ||
      fallbackMessage ||
      `Request failed (${response.status})`;

    throw new Error(errorMsg);
  }

  return data;
}

function statusClass(status) {
  return String(status || "PENDING").toLowerCase().replaceAll("_", "-");
}

function formatDate(value) {
  if (!value) return "Date not available";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function App() {
  const [mode, setMode] = useState("register");
  const [role, setRole] = useState("CUSTOMER");
  const [user, setUser] = useState(null);
  const [categories, setCategories] = useState([]);
  const [requests, setRequests] = useState([]);
  const [workerHistory, setWorkerHistory] = useState([]);
  const [workerOnline, setWorkerOnline] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [loading, setLoading] = useState(false);
  const [workerActionId, setWorkerActionId] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [workAreaForm, setWorkAreaForm] = useState({
    city: "",
    pincode: "",
  });
  const [savingWorkArea, setSavingWorkArea] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
    phone: "",
    serviceRadiusKm: 5,
    categoryIds: [],
  });

  const [requestForm, setRequestForm] = useState({
    categoryId: "",
    description: "",
    city: "",
    pincode: "",
  });

  const showMessage = (text, type = "info") => {
    setMessage(text);
    setMessageType(type);
  };

  const loadCategories = useCallback(async () => {
    try {
      const response = await fetch(`${API}/categories`);
      const data = await readResponse(
        response,
        "Could not load service categories."
      );
      setCategories(data);
    } catch (error) {
      showMessage(error.message, "error");
    }
  }, []);

  const loadCustomerRequests = useCallback(async (customerId) => {
    const response = await fetch(
      `${API}/requests/customer/${customerId}`
    );
    const data = await readResponse(
      response,
      "Could not load your requests."
    );
    setRequests(data);
  }, []);

  const loadWorkerRequests = useCallback(async (workerId) => {
    const response = await fetch(
      `${API}/workers/${workerId}/requests`
    );
    const data = await readResponse(
      response,
      "Could not load available requests."
    );
    setRequests(data);
  }, []);

  const loadWorkerHistory = useCallback(async (workerId) => {
    setHistoryLoading(true);

    try {
      const response = await fetch(
        `${API}/workers/${workerId}/my-requests`
      );
      const data = await readResponse(
        response,
        "Could not load worker history."
      );
      setWorkerHistory(data);
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Load the provider's saved work area and online status.
  useEffect(() => {
    if (user?.role !== "WORKER" || !user.workerId) return;

    let cancelled = false;

    async function loadWorkArea() {
      try {
        const response = await fetch(
          `${API}/workers/${user.workerId}/work-area`
        );

        const data = await readResponse(
          response,
          "Could not load your work area."
        );

        if (cancelled) return;

        setWorkAreaForm({
          city: data.city || "",
          pincode: data.pincode || "",
        });

        setWorkerOnline(Boolean(data.online));
      } catch (error) {
        if (!cancelled) {
          showMessage(error.message, "error");
        }
      }
    }

    loadWorkArea();

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Load the appropriate dashboard data after login.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    async function loadDashboard() {
      try {
        if (user.role === "CUSTOMER") {
          const response = await fetch(
            `${API}/requests/customer/${user.id}`
          );

          const data = await readResponse(
            response,
            "Could not load your requests."
          );

          if (!cancelled) setRequests(data);
        } else if (user.role === "WORKER" && user.workerId) {
          const [availableResponse, historyResponse] =
            await Promise.all([
              fetch(
                `${API}/workers/${user.workerId}/requests`
              ),
              fetch(
                `${API}/workers/${user.workerId}/my-requests`
              ),
            ]);

          const available = await readResponse(
            availableResponse,
            "Could not load available requests."
          );

          const history = await readResponse(
            historyResponse,
            "Could not load worker history."
          );

          if (!cancelled) {
            setRequests(available);
            setWorkerHistory(history);
          }
        }
      } catch (error) {
        if (!cancelled) {
          showMessage(error.message, "error");
        }
      }
    }

    loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [user, loadWorkerRequests, loadWorkerHistory]);

  function updateAuthForm(event) {
    const { name, value } = event.target;

    setAuthForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function toggleCategory(id) {
    setAuthForm((previous) => ({
      ...previous,
      categoryIds: previous.categoryIds.includes(id)
        ? previous.categoryIds.filter((item) => item !== id)
        : [...previous.categoryIds, id],
    }));
  }

  // Register a customer/provider or log in an existing user.
  async function handleAuth(event) {
    event.preventDefault();
    setLoading(true);
    showMessage("");

    try {
      const isRegister = mode === "register";
      const endpoint = isRegister
        ? "/auth/register"
        : "/auth/login";

      const body = isRegister
        ? {
            ...authForm,
            serviceRadiusKm:
              role === "WORKER"
                ? Number(authForm.serviceRadiusKm)
                : null,
            categoryIds:
              role === "WORKER"
                ? authForm.categoryIds
                : [],
            role,
          }
        : {
            email: authForm.email,
            password: authForm.password,
          };

      const response = await fetch(`${API}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await readResponse(
        response,
        `Request failed (${response.status})`
      );

      if (isRegister) {
        setMode("login");
        setAuthForm((previous) => ({
          ...previous,
          password: "",
        }));
        showMessage(
          "Registration successful. Please log in.",
          "success"
        );
      } else {
        setUser(data);
        setRequests([]);
        setWorkerHistory([]);
        setWorkerOnline(false);

        showMessage(`Welcome back, ${data.name}!`, "success");
      }
    } catch (error) {
      showMessage(
        error.message || "Something went wrong.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  // Submit a new customer service request.
  async function createRequest(event) {
    event.preventDefault();
    setLoading(true);
    showMessage("");

    try {
      const response = await fetch(`${API}/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerId: user.id,
          categoryId: Number(requestForm.categoryId),
          description: requestForm.description.trim(),
          city: requestForm.city.trim(),
          pincode: requestForm.pincode.trim(),
        }),
      });

      const data = await readResponse(
        response,
        "Could not create the request."
      );

      setRequests((previous) => [data, ...previous]);

      setRequestForm({
        categoryId: "",
        description: "",
        city: "",
        pincode: "",
      });

      showMessage(
        `Service request #${data.id} created successfully.`,
        "success"
      );
    } catch (error) {
      showMessage(
        error.message || "Could not create the request.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }

  // Provider goes online/offline.
  async function changeAvailability(online) {
    if (!user?.workerId) {
      showMessage(
        "Your login response does not contain workerId. Check AuthResponse.java.",
        "error"
      );
      return;
    }

    if (online) {
      const pincode = (workAreaForm.pincode || "").trim();
      const city = (workAreaForm.city || "").trim();

      if (!pincode || !/^\d{6}$/.test(pincode)) {
        showMessage(
          "Please enter your work city and a valid 6-digit pincode in the 'Where do you want to work?' section below, then save it before going online.",
          "error"
        );
        const section = document.getElementById("work-area-section");
        if (section) section.scrollIntoView({ behavior: "smooth" });
        return;
      }

      // If city and pincode are typed, auto-save the work area first
      if (city && pincode) {
        try {
          await fetch(`${API}/workers/${user.workerId}/work-area`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ city, pincode }),
          });
        } catch {
          // Continue to availability attempt
        }
      }
    }

    setLoading(true);
    showMessage("");

    try {
      const response = await fetch(
        `${API}/workers/${user.workerId}/availability`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ online }),
        }
      );

      const data = await readResponse(
        response,
        online
          ? "Could not go online. Please ensure your work city and 6-digit pincode are saved below."
          : "Could not go offline."
      );

      setWorkerOnline(online);

      await loadWorkerRequests(user.workerId);

      showMessage(
        data.message ||
          (online
            ? "You are now online and ready to receive requests."
            : "You are now offline."),
        "success"
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setLoading(false);
    }
  }

  // Save the provider's work city and pincode.
  async function saveWorkArea(event) {
    event.preventDefault();

    if (!user?.workerId) {
      showMessage(
        "Your login response does not contain workerId. Check AuthResponse.java.",
        "error"
      );
      return;
    }

    if (!/^\d{6}$/.test(workAreaForm.pincode.trim())) {
      showMessage(
        "Enter a valid six-digit work pincode.",
        "error"
      );
      return;
    }

    setSavingWorkArea(true);
    showMessage("");

    try {
      const response = await fetch(
        `${API}/workers/${user.workerId}/work-area`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            city: workAreaForm.city.trim(),
            pincode: workAreaForm.pincode.trim(),
          }),
        }
      );

      const data = await readResponse(
        response,
        "Could not save your work area."
      );

      showMessage(
        data.message || "Work area saved successfully.",
        "success"
      );

      if (workerOnline) {
        await loadWorkerRequests(user.workerId);
      }
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setSavingWorkArea(false);
    }
  }

  // Provider accepts a customer request.
  async function acceptRequest(requestId) {
    if (!user?.workerId) return;

    setWorkerActionId(requestId);
    showMessage("");

    try {
      const response = await fetch(
        `${API}/workers/${user.workerId}/requests/${requestId}/accept`,
        { method: "POST" }
      );

      await readResponse(
        response,
        "Could not accept this request."
      );

      await Promise.all([
        loadWorkerRequests(user.workerId),
        loadWorkerHistory(user.workerId),
      ]);

      showMessage(
        `Request #${requestId} accepted. You are assigned to this job.`,
        "success"
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setWorkerActionId(null);
    }
  }

  // Provider updates a job to IN_PROGRESS or COMPLETED.
  async function updateRequestStatus(requestId, status) {
    if (!user?.workerId) return;

    setWorkerActionId(requestId);
    showMessage("");

    try {
      const response = await fetch(
        `${API}/workers/${user.workerId}/requests/${requestId}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      await readResponse(
        response,
        "Could not update the request status."
      );

      await loadWorkerHistory(user.workerId);
      await loadWorkerRequests(user.workerId);

      showMessage(
        status === "IN_PROGRESS"
          ? `Request #${requestId} marked as in progress.`
          : `Request #${requestId} completed successfully.`,
        "success"
      );
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      setWorkerActionId(null);
    }
  }

  async function refreshWorkerDashboard() {
    if (!user?.workerId) return;

    setLoading(true);

    try {
      await Promise.all([
        loadWorkerRequests(user.workerId),
        loadWorkerHistory(user.workerId),
      ]);

      showMessage("Dashboard refreshed.", "success");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    setUser(null);
    setRequests([]);
    setWorkerHistory([]);
    setWorkerOnline(false);
    setWorkAreaForm({ city: "", pincode: "" });
    setMode("login");
    setMessage("");
    setMessageType("info");
  }

  // PART 9B: Admin dashboard route.
  if (user?.role === "ADMIN") {
    return (
      <AdminDashboard
        user={user}
        onLogout={logout}
      />
    );
  }

  // Customer dashboard.
  if (user?.role === "CUSTOMER") {
    return (
      <main className="app-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(event) => event.preventDefault()}
          >
            <span className="brand-mark">Q</span>
            <span>
              Quick<span className="brand-accent">Fix</span>
            </span>
          </a>

          <div className="topbar-right">
            <div className="user-chip">
              <span className="avatar">
                {user.name?.charAt(0)?.toUpperCase() || "U"}
              </span>
              <span>{user.name}</span>
            </div>

            <button
              className="button button-ghost button-small"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="hero hero-customer">
            <div className="hero-copy">
              <span className="eyebrow">
                <span className="eyebrow-dot" /> HOME SERVICES, SIMPLIFIED
              </span>
              <h1>
                What needs
                <br />
                fixing today?
              </h1>
              <p>
                Book a trusted local professional and get your home back on track.
              </p>
              <a className="hero-link" href="#create-request">
                Request a service <span>↘</span>
              </a>
            </div>

            <div className="hero-illustration" aria-hidden="true">
              <div className="illustration-circle circle-one" />
              <div className="illustration-circle circle-two" />
              <div className="tool-card tool-card-main">
                <span>⌁</span>
                <strong>Home care</strong>
                <small>Made simple</small>
              </div>
              <div className="tool-card tool-card-float">
                <span>✓</span>
                <div>
                  <strong>Quick response</strong>
                  <small>Local professionals</small>
                </div>
              </div>
              <div className="illustration-spark spark-one">✦</div>
              <div className="illustration-spark spark-two">✧</div>
            </div>
          </section>

          {message && (
            <div className={`message message-${messageType}`} role="status">
              {message}
            </div>
          )}

          <div className="section-heading" id="create-request">
            <div>
              <span className="section-kicker">GET STARTED</span>
              <h2>Request a service</h2>
            </div>
            <span className="section-note">Tell us what you need</span>
          </div>

          <div className="customer-grid">
            <section className="surface form-surface">
              <div className="surface-heading">
                <span className="heading-icon">＋</span>
                <div>
                  <h3>Service details</h3>
                  <p>
                    Share a few details so the right professional can help.
                  </p>
                </div>
              </div>

              <form onSubmit={createRequest} className="form-stack">
                <label className="field">
                  <span>Service category</span>
                  <select
                    value={requestForm.categoryId}
                    onChange={(event) =>
                      setRequestForm({
                        ...requestForm,
                        categoryId: event.target.value,
                      })
                    }
                    required
                  >
                    <option value="">Choose a service</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field">
                  <span>Describe the problem</span>
                  <textarea
                    value={requestForm.description}
                    onChange={(event) =>
                      setRequestForm({
                        ...requestForm,
                        description: event.target.value,
                      })
                    }
                    placeholder="Example: Water is leaking from the kitchen tap."
                    maxLength={1000}
                    rows={4}
                    required
                  />
                  <small className="field-hint">
                    Be specific to help the professional prepare.
                  </small>
                </label>

                <div className="form-grid-two">
                  <label className="field">
                    <span>City</span>
                    <input
                      value={requestForm.city}
                      onChange={(event) =>
                        setRequestForm({
                          ...requestForm,
                          city: event.target.value,
                        })
                      }
                      placeholder="e.g. Hyderabad"
                      maxLength={100}
                      required
                    />
                  </label>

                  <label className="field">
                    <span>Pincode</span>
                    <input
                      value={requestForm.pincode}
                      onChange={(event) =>
                        setRequestForm({
                          ...requestForm,
                          pincode: event.target.value,
                        })
                      }
                      placeholder="6-digit pincode"
                      inputMode="numeric"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      required
                    />
                  </label>
                </div>

                <button
                  className="button button-primary button-wide"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="spinner" /> Submitting…
                    </>
                  ) : (
                    "Submit service request"
                  )}{" "}
                  <span aria-hidden="true">→</span>
                </button>
              </form>
            </section>

            <section className="surface history-surface">
              <div className="surface-heading">
                <span className="heading-icon heading-icon-lilac">▤</span>
                <div>
                  <h3>Your requests</h3>
                  <p>Keep track of every service you book.</p>
                </div>
              </div>

              <div className="mini-stats">
                <div>
                  <strong>{requests.length}</strong>
                  <span>Total requests</span>
                </div>
                <div>
                  <strong>
                    {requests.filter((item) => item.status === "COMPLETED").length}
                  </strong>
                  <span>Completed</span>
                </div>
                <div>
                  <strong>
                    {
                      requests.filter((item) =>
                        ["PENDING", "ACCEPTED", "IN_PROGRESS"].includes(
                          item.status
                        )
                      ).length
                    }
                  </strong>
                  <span>In progress</span>
                </div>
              </div>

              {requests.length === 0 ? (
                <div className="empty-state">
                  <span className="empty-icon">⌂</span>
                  <h4>No requests yet</h4>
                  <p>
                    Your service requests will appear here after you submit one.
                  </p>
                </div>
              ) : (
                <div className="request-list">
                  {requests.map((request) => (
                    <article className="request-card" key={request.id}>
                      <div className="request-card-top">
                        <span className="request-number">
                          REQUEST #{request.id}
                        </span>
                        <span
                          className={`status status-${statusClass(request.status)}`}
                        >
                          {(request.status || "PENDING").replaceAll("_", " ")}
                        </span>
                      </div>
                      <h4>{request.categoryName || "Home service"}</h4>
                      <p className="request-description">
                        {request.description}
                      </p>
                      <div className="request-meta">
                        <span>
                          ⌖ {request.city} · {request.pincode}
                        </span>
                        <span>{formatDate(request.createdAt)}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <footer className="footer">
          © {new Date().getFullYear()} QuickFix
          <span>Local help, right when you need it.</span>
        </footer>
      </main>
    );
  }

  // Service provider dashboard.
  if (user?.role === "WORKER") {
    const activeJobs = workerHistory.filter((item) =>
      ["ACCEPTED", "IN_PROGRESS"].includes(item.status)
    );

    const completedJobs = workerHistory.filter(
      (item) => item.status === "COMPLETED"
    );

    return (
      <main className="app-shell">
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(event) => event.preventDefault()}
          >
            <span className="brand-mark">Q</span>
            <span>
              Quick<span className="brand-accent">Fix</span>
            </span>
          </a>

          <div className="topbar-right">
            <div className="user-chip">
              <span className="avatar">
                {user.name?.charAt(0)?.toUpperCase() || "W"}
              </span>
              <span>{user.name}</span>
            </div>
            <button
              className="button button-ghost button-small"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </header>

        <div className="content-wrap">
          <section className="worker-hero">
            <div>
              <span className="eyebrow">
                <span className="eyebrow-dot" /> PROFESSIONAL DASHBOARD
              </span>
              <h1>Good work starts here.</h1>
              <p>
                Manage incoming jobs, update service progress, and keep your work organized.
              </p>
            </div>

            <div className={`availability-card ${workerOnline ? "is-online" : ""}`}>
              <div className="availability-indicator">
                <span />
              </div>
              <div className="availability-copy">
                <strong>{workerOnline ? "You’re online" : "You’re offline"}</strong>
                <span>
                  {workerOnline
                    ? "You can receive service requests"
                    : "Go online when you’re ready to work"}
                </span>
              </div>
              <button
                className={`button ${
                  workerOnline ? "button-offline" : "button-online"
                }`}
                onClick={() => changeAvailability(!workerOnline)}
                disabled={loading}
              >
                {workerOnline ? "Go offline" : "Go online"}
              </button>
            </div>
          </section>

          {message && (
            <div className={`message message-${messageType}`} role="status">
              {message}
            </div>
          )}

          <section id="work-area-section" className="surface form-surface" style={{ marginBottom: 24 }}>
            <div className="surface-heading">
              <span className="heading-icon">⌖</span>
              <div>
                <h3>Where do you want to work?</h3>
                <p>
                  Save your service city and pincode to find matching customer jobs.
                </p>
              </div>
            </div>

            <form onSubmit={saveWorkArea} className="form-stack">
              <div className="form-grid-two">
                <label className="field">
                  <span>Work city</span>
                  <input
                    value={workAreaForm.city}
                    onChange={(event) =>
                      setWorkAreaForm({
                        ...workAreaForm,
                        city: event.target.value,
                      })
                    }
                    placeholder="e.g. Hyderabad"
                    maxLength={100}
                    required
                  />
                </label>

                <label className="field">
                  <span>Work pincode</span>
                  <input
                    value={workAreaForm.pincode}
                    onChange={(event) =>
                      setWorkAreaForm({
                        ...workAreaForm,
                        pincode: event.target.value,
                      })
                    }
                    placeholder="Enter six-digit pincode"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    required
                  />
                </label>
              </div>

              <button
                className="button button-primary"
                type="submit"
                disabled={savingWorkArea}
              >
                {savingWorkArea ? "Saving..." : "Save work area"}
              </button>
            </form>

            <p className="field-hint">
              Current work area: {workAreaForm.city || "Not set"}
              {workAreaForm.pincode ? ` — ${workAreaForm.pincode}` : ""}
            </p>
          </section>

          <div className="stats-grid">
            <div className="stat-card">
              <span className="stat-icon stat-icon-blue">⌕</span>
              <div>
                <span>Available jobs</span>
                <strong>{requests.length}</strong>
                <small>Matching your services</small>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon stat-icon-purple">▣</span>
              <div>
                <span>Active jobs</span>
                <strong>{activeJobs.length}</strong>
                <small>Accepted or in progress</small>
              </div>
            </div>

            <div className="stat-card">
              <span className="stat-icon stat-icon-green">✓</span>
              <div>
                <span>Completed jobs</span>
                <strong>{completedJobs.length}</strong>
                <small>Finished services</small>
              </div>
            </div>
          </div>

          <section className="surface worker-jobs-surface">
            <div className="section-heading inside-heading">
              <div>
                <span className="section-kicker">JOB BOARD</span>
                <h2>Available requests</h2>
              </div>
              <button
                className="button button-ghost"
                onClick={refreshWorkerDashboard}
                disabled={loading}
              >
                ↻ Refresh
              </button>
            </div>

            {!workerOnline ? (
              <div className="notice-panel">
                <span className="notice-icon">☝</span>
                <div>
                  <strong>You’re currently offline</strong>
                  <p>
                    Save your work pincode, then go online to receive matching jobs.
                  </p>
                </div>
              </div>
            ) : requests.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon">⌕</span>
                <h4>No matching requests right now</h4>
                <p>
                  Keep your status online. New matching service requests will appear here when available.
                </p>
              </div>
            ) : (
              <div className="job-grid">
                {requests.map((request) => (
                  <article className="job-card" key={request.id}>
                    <div className="job-card-top">
                      <span className="job-category-icon">⌂</span>
                      <span className="request-number">
                        REQUEST #{request.id}
                      </span>
                      <span
                        className={`status status-${statusClass(request.status)}`}
                      >
                        {(request.status || "PENDING").replaceAll("_", " ")}
                      </span>
                    </div>

                    <h3>{request.categoryName || "Home service"}</h3>
                    <p className="request-description">{request.description}</p>

                    <div className="job-details">
                      <div>
                        <span>LOCATION</span>
                        <strong>{request.city}</strong>
                        <small>Pincode {request.pincode}</small>
                      </div>
                      <div>
                        <span>REQUESTED</span>
                        <strong>{formatDate(request.createdAt)}</strong>
                      </div>
                    </div>

                    <button
                      className="button button-primary button-wide"
                      onClick={() => acceptRequest(request.id)}
                      disabled={
                        workerActionId === request.id || !workerOnline
                      }
                    >
                      {workerActionId === request.id
                        ? "Accepting…"
                        : "Accept request"}{" "}
                      <span>→</span>
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="surface worker-jobs-surface history-section">
            <div className="section-heading inside-heading">
              <div>
                <span className="section-kicker">YOUR WORK</span>
                <h2>My job history</h2>
              </div>
              <span className="section-note">
                {workerHistory.length} jobs
              </span>
            </div>

            {historyLoading ? (
              <p className="muted">Loading your job history…</p>
            ) : workerHistory.length === 0 ? (
              <div className="empty-state compact-empty">
                <span className="empty-icon">▤</span>
                <h4>No accepted jobs yet</h4>
                <p>When you accept a request, it will appear here.</p>
              </div>
            ) : (
              <div className="history-list">
                {workerHistory.map((request) => (
                  <article className="history-row" key={request.id}>
                    <div className="history-main">
                      <span className="history-category-icon">⌂</span>
                      <div>
                        <div className="history-title-row">
                          <h4>{request.categoryName || "Home service"}</h4>
                          <span
                            className={`status status-${statusClass(request.status)}`}
                          >
                            {(request.status || "").replaceAll("_", " ")}
                          </span>
                        </div>
                        <p>{request.description}</p>
                        <small>
                          #{request.id} · {request.city} · {request.pincode} ·{" "}
                          {formatDate(request.createdAt)}
                        </small>
                      </div>
                    </div>

                    <div className="history-actions">
                      {request.status === "ACCEPTED" && (
                        <button
                          className="button button-primary button-small"
                          onClick={() =>
                            updateRequestStatus(request.id, "IN_PROGRESS")
                          }
                          disabled={workerActionId === request.id}
                        >
                          {workerActionId === request.id
                            ? "Updating…"
                            : "Start service"}
                        </button>
                      )}

                      {request.status === "IN_PROGRESS" && (
                        <button
                          className="button button-complete button-small"
                          onClick={() =>
                            updateRequestStatus(request.id, "COMPLETED")
                          }
                          disabled={workerActionId === request.id}
                        >
                          {workerActionId === request.id
                            ? "Updating…"
                            : "Complete service"}
                        </button>
                      )}

                      {request.status === "COMPLETED" && (
                        <span className="completed-label">
                          ✓ Completed
                        </span>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        <footer className="footer">
          © {new Date().getFullYear()} QuickFix
          <span>Thank you for helping your community.</span>
        </footer>
      </main>
    );
  }

  // Fallback for any role without a dashboard.
  if (user) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <a
            className="brand brand-centered"
            href="#"
            onClick={(event) => event.preventDefault()}
          >
            <span className="brand-mark">Q</span>
            <span>
              Quick<span className="brand-accent">Fix</span>
            </span>
          </a>

          <h2>Welcome, {user.name}</h2>
          <p className="auth-subtitle">
            Your account role is {user.role}. This dashboard is not available for that role yet.
          </p>
          <button
            className="button button-primary button-wide"
            onClick={logout}
          >
            Log out
          </button>
        </section>
      </main>
    );
  }

  // Registration and login page.
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <div className="auth-brand-panel">
          <a
            className="brand"
            href="#"
            onClick={(event) => event.preventDefault()}
          >
            <span className="brand-mark">Q</span>
            <span>
              Quick<span className="brand-accent">Fix</span>
            </span>
          </a>

          <span className="auth-illustration" aria-hidden="true">
            ⌂
          </span>
          <p>Small fixes. Trusted professionals. More peace of mind.</p>
        </div>

        <div className="auth-form-panel">
          <span className="section-kicker">WELCOME TO QUICKFIX</span>
          <h1>
            {mode === "register"
              ? "Create your account"
              : "Welcome back"}
          </h1>
          <p className="auth-subtitle">
            {mode === "register"
              ? "Join your local home-service community."
              : "Log in to continue to your dashboard."}
          </p>

          <div className="tabs">
            <button
              type="button"
              className={mode === "register" ? "active" : ""}
              onClick={() => {
                setMode("register");
                showMessage("");
              }}
            >
              Create account
            </button>
            <button
              type="button"
              className={mode === "login" ? "active" : ""}
              onClick={() => {
                setMode("login");
                showMessage("");
              }}
            >
              Log in
            </button>
          </div>

          <form onSubmit={handleAuth} className="form-stack">
            {mode === "register" && (
              <>
                <label className="field">
                  <span>Register as</span>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                  >
                    <option value="CUSTOMER">Customer</option>
                    <option value="WORKER">Service provider</option>
                  </select>
                </label>

                <label className="field">
                  <span>Full name</span>
                  <input
                    name="name"
                    value={authForm.name}
                    onChange={updateAuthForm}
                    placeholder="Your full name"
                    required
                  />
                </label>

                <label className="field">
                  <span>Phone number</span>
                  <input
                    name="phone"
                    type="tel"
                    value={authForm.phone}
                    onChange={updateAuthForm}
                    placeholder="Your phone number"
                  />
                </label>
              </>
            )}

            <label className="field">
              <span>Email address</span>
              <input
                name="email"
                type="email"
                value={authForm.email}
                onChange={updateAuthForm}
                placeholder="you@example.com"
                required
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                minLength={8}
                value={authForm.password}
                onChange={updateAuthForm}
                placeholder="At least 8 characters"
                required
              />
            </label>

            {mode === "register" && role === "WORKER" && (
              <>
                <label className="field">
                  <span>Service radius (km)</span>
                  <input
                    name="serviceRadiusKm"
                    type="number"
                    min="1"
                    max="50"
                    value={authForm.serviceRadiusKm}
                    onChange={updateAuthForm}
                    required
                  />
                </label>

                <fieldset className="category-fieldset">
                  <legend>Services you provide</legend>
                  <div className="category-grid">
                    {categories.map((category) => (
                      <label
                        className="category-option"
                        key={category.id}
                      >
                        <input
                          type="checkbox"
                          checked={authForm.categoryIds.includes(category.id)}
                          onChange={() => toggleCategory(category.id)}
                        />
                        <span>{category.name}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            )}

            <button
              className="button button-primary button-wide"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Please wait…
                </>
              ) : mode === "register" ? (
                "Create account"
              ) : (
                "Log in"
              )}{" "}
              <span>→</span>
            </button>
          </form>

          {message && (
            <div className={`message message-${messageType}`} role="status">
              {message}
            </div>
          )}

          <p className="auth-footnote">
            By continuing, you agree to use QuickFix responsibly and respectfully.
          </p>
        </div>
      </section>
    </main>
  );
}

export default App;
