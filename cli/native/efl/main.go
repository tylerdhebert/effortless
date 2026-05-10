package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
)

type serverState struct {
	Port  int    `json:"port"`
	Token string `json:"token"`
}

type commandRequest struct {
	Args []string          `json:"args"`
	Cwd  string            `json:"cwd"`
	Env  map[string]string `json:"env"`
}

type commandResponse struct {
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
	ExitCode int    `json:"exitCode"`
}

var forwardedEnv = []string{
	"EFFORTLESS_TASK",
	"EFFORTLESS_RUN_ID",
	"EFFORTLESS_RUN_LABEL",
	"EFFORTLESS_EFFORT",
	"CODEX_THREAD_ID",
}

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func run() error {
	state, err := readServerState()
	if err != nil {
		return err
	}

	cwd, err := os.Getwd()
	if err != nil {
		return err
	}

	result, err := postCommand(state, commandRequest{
		Args: os.Args[1:],
		Cwd:  cwd,
		Env:  collectEnv(),
	})
	if err != nil {
		return err
	}

	if result.Stdout != "" {
		fmt.Fprint(os.Stdout, result.Stdout)
		if result.Stdout[len(result.Stdout)-1] != '\n' {
			fmt.Fprintln(os.Stdout)
		}
	}
	if result.Stderr != "" {
		fmt.Fprint(os.Stderr, result.Stderr)
		if result.Stderr[len(result.Stderr)-1] != '\n' {
			fmt.Fprintln(os.Stderr)
		}
	}

	os.Exit(result.ExitCode)
	return nil
}

func readServerState() (serverState, error) {
	statePath, err := serverStatePath()
	if err != nil {
		return serverState{}, err
	}

	data, err := os.ReadFile(statePath)
	if errors.Is(err, os.ErrNotExist) {
		return serverState{}, errors.New("Effortless is not running. Open the app before using efl.")
	}
	if err != nil {
		return serverState{}, err
	}

	var state serverState
	if err := json.Unmarshal(data, &state); err != nil {
		return serverState{}, fmt.Errorf("could not read Effortless command server state: %w", err)
	}
	if state.Port == 0 || state.Token == "" {
		return serverState{}, errors.New("Effortless command server state is incomplete. Restart the app and try again.")
	}

	return state, nil
}

func serverStatePath() (string, error) {
	if home := os.Getenv("EFFORTLESS_HOME"); home != "" {
		return filepath.Join(home, "cli-server.json"), nil
	}

	if runtime.GOOS == "windows" {
		appData := os.Getenv("APPDATA")
		if appData == "" {
			return "", errors.New("APPDATA is not set")
		}
		return filepath.Join(appData, "effortless", "cli-server.json"), nil
	}

	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome == "" {
		userHome, err := os.UserHomeDir()
		if err != nil {
			return "", err
		}
		configHome = filepath.Join(userHome, ".config")
	}
	return filepath.Join(configHome, "effortless", "cli-server.json"), nil
}

func collectEnv() map[string]string {
	env := make(map[string]string)
	for _, name := range forwardedEnv {
		if value, ok := os.LookupEnv(name); ok {
			env[name] = value
		}
	}
	return env
}

func postCommand(state serverState, payload commandRequest) (commandResponse, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return commandResponse{}, err
	}

	request, err := http.NewRequest("POST", fmt.Sprintf("http://127.0.0.1:%d/cli", state.Port), bytes.NewReader(body))
	if err != nil {
		return commandResponse{}, err
	}
	request.Header.Set("Authorization", "Bearer "+state.Token)
	request.Header.Set("Content-Type", "application/json")

	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return commandResponse{}, errors.New("Effortless command server is unavailable. Restart the app and try again.")
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return commandResponse{}, err
	}

	if response.StatusCode >= 400 {
		return commandResponse{}, fmt.Errorf("Effortless command server returned %d: %s", response.StatusCode, string(responseBody))
	}

	var result commandResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return commandResponse{}, fmt.Errorf("could not read Effortless command response: %w", err)
	}

	return result, nil
}
