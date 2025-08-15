const axios = require("axios");

class ApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, ""); // remove trailing slash
    this.options = options;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeout || 10000,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        const url = config.baseURL + config.url;
        console.log(`🔄 ${config.method.toUpperCase()} ${url}`);
        return config;
      },
      (error) => {
        console.error("Request error:", error.message);
        return Promise.reject(error);
      }
    );

    // add response interceptor for logging and error handling
    this.client.interceptors.response.use(
      (response) => {
        console.log(`✅ ${response.status} ${response.statusText}`);
        return response;
      },
      (error) => {
        if (error.response) {
          // server responded with error status
          console.error(
            `❌ ${error.response.status} ${error.response.statusText}`
          );
          if (error.response.data) {
            console.error(
              "Response data:",
              JSON.stringify(error.response.data, null, 2)
            );
          }
        } else if (error.request) {
          // request was made but no response received
          console.error("❌ No response received:", error.message);
        } else {
          // something else happened
          console.error("❌ Request setup error:", error.message);
        }
        return Promise.reject(error);
      }
    );
  }

  async request(method, url, data = null, options = {}) {
    try {
      const config = {
        method: method.toLowerCase(),
        url: url,
        ...options,
      };

      // handle request body for different methods
      if (data && ["post", "put", "patch"].includes(method.toLowerCase())) {
        config.data = data;
      } else if (data && method.toLowerCase() === "get") {
        config.params = data;
      }

      // merge headers: default headers + request-specific headers
      // (request headers take precedence)
      if (options.headers) {
        config.headers = {
          ...this.client.defaults.headers,
          ...options.headers,
        };
      }

      const response = await this.client.request(config);

      return {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data,
      };
    } catch (error) {
      // transform axios error to a more consistent format
      if (error.response) {
        // server error response
        const errorMessage = this.formatErrorMessage(error.response);
        throw new Error(errorMessage);
      } else if (error.request) {
        // network error
        throw new Error(`Network error: ${error.message}`);
      } else {
        // other error
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  formatErrorMessage(response) {
    let message = `API request failed: ${response.status} ${response.statusText}`;

    if (response.data) {
      if (typeof response.data === "string") {
        message += `. ${response.data}`;
      } else if (response.data.message) {
        message += `. ${response.data.message}`;
      } else if (response.data.error) {
        message += `. ${response.data.error}`;
      } else {
        message += `. Details: ${JSON.stringify(response.data)}`;
      }
    }

    return message;
  }

  // convenience methods
  async get(url, params = null, options = {}) {
    return this.request("GET", url, params, options);
  }

  async post(url, data = null, options = {}) {
    return this.request("POST", url, data, options);
  }

  async put(url, data = null, options = {}) {
    return this.request("PUT", url, data, options);
  }

  async patch(url, data = null, options = {}) {
    return this.request("PATCH", url, data, options);
  }

  async delete(url, data = null, options = {}) {
    return this.request("DELETE", url, data, options);
  }

  async head(url, options = {}) {
    return this.request("HEAD", url, null, options);
  }

  async options(url, options = {}) {
    return this.request("OPTIONS", url, null, options);
  }

  // authentication methods
  setAuthToken(token) {
    if (token) {
      this.client.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    } else {
      delete this.client.defaults.headers.common["Authorization"];
    }
  }

  setApiKey(key, headerName = "X-API-Key") {
    if (key) {
      this.client.defaults.headers.common[headerName] = key;
    } else {
      delete this.client.defaults.headers.common[headerName];
    }
  }

  setBasicAuth(username, password) {
    if (username && password) {
      const credentials = Buffer.from(`${username}:${password}`).toString(
        "base64"
      );
      this.client.defaults.headers.common[
        "Authorization"
      ] = `Basic ${credentials}`;
    } else {
      delete this.client.defaults.headers.common["Authorization"];
    }
  }

  // configuration methods
  setHeaders(headers) {
    Object.assign(this.client.defaults.headers, headers);
  }

  removeHeader(headerName) {
    delete this.client.defaults.headers.common[headerName];
  }

  setTimeout(timeout) {
    this.client.defaults.timeout = timeout;
  }

  setBaseURL(baseUrl) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.client.defaults.baseURL = this.baseUrl;
  }

  // request delay for rate limiting
  setRequestDelay(delayMs) {
    if (delayMs > 0) {
      this.client.interceptors.request.use(async (config) => {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        return config;
      });
    }
  }

  // retry configuration
  setRetryConfig(retries = 3, retryDelay = 1000) {
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const config = error.config;

        if (!config || !config.retry) {
          config.retry = 0;
        }

        if (config.retry >= retries) {
          return Promise.reject(error);
        }

        config.retry += 1;

        // only retry on network errors or 5xx status codes
        if (error.response && error.response.status < 500) {
          return Promise.reject(error);
        }

        console.log(
          `🔄 Retrying request (attempt ${config.retry}/${retries})...`
        );

        await new Promise((resolve) => setTimeout(resolve, retryDelay));

        return this.client(config);
      }
    );
  }

  // request/response interceptor management
  addRequestInterceptor(onFulfilled, onRejected) {
    return this.client.interceptors.request.use(onFulfilled, onRejected);
  }

  addResponseInterceptor(onFulfilled, onRejected) {
    return this.client.interceptors.response.use(onFulfilled, onRejected);
  }

  removeInterceptor(type, interceptorId) {
    if (type === "request") {
      this.client.interceptors.request.eject(interceptorId);
    } else if (type === "response") {
      this.client.interceptors.response.eject(interceptorId);
    }
  }

  // cookie support
  enableCookies() {
    this.client.defaults.withCredentials = true;
  }

  disableCookies() {
    this.client.defaults.withCredentials = false;
  }

  // ssl/tls configuration
  setSSLConfig(options) {
    this.client.defaults.httpsAgent = new (require("https").Agent)(options);
  }

  ignoreSslErrors() {
    this.setSSLConfig({ rejectUnauthorized: false });
  }

  // get current configuration
  getConfig() {
    return {
      baseURL: this.client.defaults.baseURL,
      timeout: this.client.defaults.timeout,
      headers: this.client.defaults.headers,
      withCredentials: this.client.defaults.withCredentials,
    };
  }

  // create a new instance with different config
  createInstance(config) {
    return new ApiClient(config.baseUrl || this.baseUrl, {
      ...this.options,
      ...config,
    });
  }
}

module.exports = { ApiClient };
